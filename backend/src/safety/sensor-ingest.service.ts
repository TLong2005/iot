import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { DevicesService } from '../devices/devices.service';
import { ALERTS_QUEUE, AlertJobData } from './alert-dispatch.processor';
import { SensorPayloadDto } from './dto/sensor-payload.dto';
import { ReadingsPersistenceService } from './readings-persistence.service';
import { SensorBufferService } from './sensor-buffer.service';
import { SafetyGateway } from './safety.gateway';

/** Kết quả sau khi đã có DTO hợp lệ (MQTT và HTTP đều đi qua đây). */
export type SensorIngestResult =
  | { ok: true }
  | { ok: false; reason: 'unregistered' };

@Injectable()
export class SensorIngestService {
  private readonly log = new Logger(SensorIngestService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly buffer: SensorBufferService,
    private readonly gateway: SafetyGateway,
    private readonly devices: DevicesService,
    private readonly readingsPersist: ReadingsPersistenceService,
    @InjectQueue(ALERTS_QUEUE) private readonly alertQueue: Queue<AlertJobData>,
  ) {}

  /**
   * Xử lý một đo — cùng pipeline: mạch (MQTT), script publish MQTT, hay POST /safety/sensor.
   */
  async ingestValidated(dto: SensorPayloadDto): Promise<SensorIngestResult> {
    const pairingEnabled = this.config.get<boolean>('pairing.enabled') ?? true;
    if (
      pairingEnabled &&
      !(await this.devices.isRegistered(dto.device_id))
    ) {
      return { ok: false, reason: 'unregistered' };
    }

    const { avgTemp, avgGas, sampleCount } = await this.buffer.appendAndAverage(
      dto.device_id,
      dto.temp,
      dto.gas,
    );

    const gasTh = this.config.getOrThrow<number>('thresholds.gas');
    const tempTh = this.config.getOrThrow<number>('thresholds.temp');
    const emergency = avgGas > gasTh || avgTemp > tempTh;
    const phi = emergency ? 1 : 0;

    this.gateway.emitReading({
      device_id: dto.device_id,
      temp: dto.temp,
      gas: dto.gas,
      temp_avg: avgTemp,
      gas_avg: avgGas,
      sample_count: sampleCount,
      phi,
      thresholds: { gas: gasTh, temp: tempTh },
      at: new Date().toISOString(),
    });

    void this.readingsPersist.maybePersist({
      deviceId: dto.device_id,
      temp: dto.temp,
      gas: dto.gas,
      tempAvg: avgTemp,
      gasAvg: avgGas,
      phi: phi as 0 | 1,
    });

    if (!emergency) {
      return { ok: true };
    }

    const cooldownMs = this.config.get<number>('alerts.cooldownMs') ?? 45_000;
    const shouldDispatch = await this.buffer.acquireAlertCooldown(
      dto.device_id,
      cooldownMs,
    );
    if (!shouldDispatch) {
      this.log.debug(
        `Emergency sustained for ${dto.device_id}; cooldown active (${cooldownMs}ms), skip alert job`,
      );
      return { ok: true };
    }

    const job: AlertJobData = {
      deviceId: dto.device_id,
      tempAvg: avgTemp,
      gasAvg: avgGas,
      phi: 1,
      gasThreshold: gasTh,
      tempThreshold: tempTh,
    };

    await this.alertQueue.add('dispatch', job, {
      removeOnComplete: true,
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });

    return { ok: true };
  }
}
