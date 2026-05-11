import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { SafetyAlert } from './entities/safety-alert.entity';
import { SensorReading } from './entities/sensor-reading.entity';

export type ReadingRow = {
  id: string;
  temp: number;
  gas: number;
  tempAvg: number;
  gasAvg: number;
  phi: number;
  at: string;
};

export type StatsResult = {
  periodHours: number;
  readingsCount: number;
  temp: { min: number; max: number; avg: number };
  gas: { min: number; max: number; avg: number };
  emergencySamples: number;
  alertEvents: number;
  thresholds: { gas: number; temp: number };
};

@Injectable()
export class ReadingsQueryService {
  constructor(
    private readonly config: ConfigService,
    @InjectRepository(SensorReading)
    private readonly readings: Repository<SensorReading>,
    @InjectRepository(SafetyAlert)
    private readonly alerts: Repository<SafetyAlert>,
  ) {}

  async listRecent(
    deviceId: string,
    hours: number,
    limit: number,
  ): Promise<ReadingRow[]> {
    const since = new Date(Date.now() - hours * 3600 * 1000);
    const max = Math.min(
      limit,
      this.config.get<number>('readings.maxQueryLimit') ?? 500,
    );
    const rows = await this.readings.find({
      where: { deviceId, createdAt: Between(since, new Date()) },
      order: { createdAt: 'ASC' },
      take: max,
    });
    return rows.map((r) => ({
      id: r.id,
      temp: r.temp,
      gas: r.gas,
      tempAvg: r.tempAvg,
      gasAvg: r.gasAvg,
      phi: r.phi,
      at: r.createdAt.toISOString(),
    }));
  }

  async aggregateStats(deviceId: string, hours: number): Promise<StatsResult> {
    const gasTh = this.config.getOrThrow<number>('thresholds.gas');
    const tempTh = this.config.getOrThrow<number>('thresholds.temp');
    const since = new Date(Date.now() - hours * 3600 * 1000);

    const list = await this.readings.find({
      where: { deviceId, createdAt: Between(since, new Date()) },
      select: ['temp', 'gas', 'tempAvg', 'gasAvg', 'phi'],
    });

    const alertEvents = await this.alerts.count({
      where: {
        deviceId,
        createdAt: Between(since, new Date()),
      },
    });

    if (!list.length) {
      return {
        periodHours: hours,
        readingsCount: 0,
        temp: { min: 0, max: 0, avg: 0 },
        gas: { min: 0, max: 0, avg: 0 },
        emergencySamples: 0,
        alertEvents,
        thresholds: { gas: gasTh, temp: tempTh },
      };
    }

    const temps = list.map((r) => r.tempAvg);
    const gases = list.map((r) => r.gasAvg);
    const emergencySamples = list.filter((r) => r.phi === 1).length;

    const minMaxAvg = (xs: number[]) => ({
      min: Math.min(...xs),
      max: Math.max(...xs),
      avg: xs.reduce((a, b) => a + b, 0) / xs.length,
    });

    return {
      periodHours: hours,
      readingsCount: list.length,
      temp: minMaxAvg(temps),
      gas: minMaxAvg(gases),
      emergencySamples,
      alertEvents,
      thresholds: { gas: gasTh, temp: tempTh },
    };
  }
}
