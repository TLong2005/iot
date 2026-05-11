import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { Repository } from 'typeorm';
import { REDIS_CLIENT } from '../redis/redis.module';
import { SensorReading } from './entities/sensor-reading.entity';

const PERSIST_KEY_PREFIX = 'sensor_reading_slot:';

@Injectable()
export class ReadingsPersistenceService {
  private readonly log = new Logger(ReadingsPersistenceService.name);

  constructor(
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectRepository(SensorReading)
    private readonly readings: Repository<SensorReading>,
  ) {}

  /**
   * Ghi một điểm trung bình (theo cửa sổ Redis buffer) vào Postgres,
   * tối đa mỗi persistIntervalMs / thiết bị.
   */
  async maybePersist(args: {
    deviceId: string;
    temp: number;
    gas: number;
    tempAvg: number;
    gasAvg: number;
    phi: 0 | 1;
  }): Promise<void> {
    const intervalMs =
      this.config.get<number>('readings.persistIntervalMs') ?? 15_000;
    if (intervalMs < 1000) {
      return;
    }

    const key = `${PERSIST_KEY_PREFIX}${args.deviceId}`;
    const r = await this.redis.set(key, '1', 'PX', intervalMs, 'NX');
    if (r !== 'OK') {
      return;
    }

    try {
      await this.readings.save(
        this.readings.create({
          deviceId: args.deviceId,
          temp: args.temp,
          gas: args.gas,
          tempAvg: args.tempAvg,
          gasAvg: args.gasAvg,
          phi: args.phi,
        }),
      );
    } catch (e) {
      this.log.warn(
        `Lưu sensor_readings thất bại: ${e instanceof Error ? e.message : e}`,
      );
    }
  }
}
