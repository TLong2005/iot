import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExpoPushService } from '../devices/expo-push.service';
import { SafetyAlert } from './entities/safety-alert.entity';
import { SafetyGateway, SafetyEmergencyPayload } from './safety.gateway';

export const ALERTS_QUEUE = 'alerts';

export type AlertJobData = {
  deviceId: string;
  tempAvg: number;
  gasAvg: number;
  phi: 1;
  gasThreshold: number;
  tempThreshold: number;
};

@Processor(ALERTS_QUEUE, { concurrency: 4 })
export class AlertDispatchProcessor extends WorkerHost {
  private readonly log = new Logger(AlertDispatchProcessor.name);

  constructor(
    @InjectRepository(SafetyAlert)
    private readonly alerts: Repository<SafetyAlert>,
    private readonly gateway: SafetyGateway,
    private readonly expoPush: ExpoPushService,
  ) {
    super();
  }

  async process(job: Job<AlertJobData, void, string>): Promise<void> {
    const d = job.data;
    const row = this.alerts.create({
      deviceId: d.deviceId,
      tempAvg: d.tempAvg,
      gasAvg: d.gasAvg,
      phi: d.phi,
    });
    await this.alerts.save(row);

    const payload: SafetyEmergencyPayload = {
      device_id: d.deviceId,
      temp_avg: d.tempAvg,
      gas_avg: d.gasAvg,
      phi: 1,
      thresholds: { gas: d.gasThreshold, temp: d.tempThreshold },
      at: new Date().toISOString(),
    };
    this.gateway.emitEmergency(payload);
    await this.expoPush.sendEmergencyToDevice(d.deviceId, {
      tempAvg: d.tempAvg,
      gasAvg: d.gasAvg,
    });
    this.log.log(
      `Alert dispatched (job ${job.id}): device=${d.deviceId} φ=1`,
    );
  }
}
