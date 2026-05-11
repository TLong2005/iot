import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

/** Số mẫu MQTT gần nhất dùng để tính TB (giảm nhiễu đơn điểm). */
const WINDOW_SIZE = 5;
const KEY_PREFIX = 'safety:window:';
const ALERT_COOLDOWN_PREFIX = 'safety:alert:cooldown:';

type Sample = { temp: number; gas: number };

export type AveragedSample = {
  avgTemp: number;
  avgGas: number;
  sampleCount: number;
};

@Injectable()
export class SensorBufferService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   * Giữ đúng WINDOW_SIZE bản tin MQTT **mới nhất** (đầu list = mới nhất),
   * trả về trung bình để so ngưỡng — không bị nhiễu một mẫu lệch.
   */
  async appendAndAverage(
    deviceId: string,
    temp: number,
    gas: number,
  ): Promise<AveragedSample> {
    const key = `${KEY_PREFIX}${deviceId}`;
    const entry: Sample = { temp, gas };
    const pipeline = this.redis.pipeline();
    pipeline.lpush(key, JSON.stringify(entry));
    pipeline.ltrim(key, 0, WINDOW_SIZE - 1);
    await pipeline.exec();

    const raw = await this.redis.lrange(key, 0, -1);
    const samples: Sample[] = raw.map((s: string) => JSON.parse(s) as Sample);
    const n = samples.length;
    if (n === 0) {
      return { avgTemp: temp, avgGas: gas, sampleCount: 0 };
    }
    const avgTemp =
      samples.reduce((acc, x) => acc + x.temp, 0) / n;
    const avgGas = samples.reduce((acc, x) => acc + x.gas, 0) / n;
    return { avgTemp, avgGas, sampleCount: n };
  }

  /**
   * Returns true if this device may dispatch a new emergency job (Redis SET NX + TTL).
   */
  async acquireAlertCooldown(deviceId: string, ttlMs: number): Promise<boolean> {
    const key = `${ALERT_COOLDOWN_PREFIX}${deviceId}`;
    const r = await this.redis.set(key, '1', 'PX', ttlMs, 'NX');
    return r === 'OK';
  }
}
