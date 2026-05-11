import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import { Device } from './entities/device.entity';

@Injectable()
export class DevicesService implements OnModuleInit {
  private readonly log = new Logger(DevicesService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Device)
    private readonly devices: Repository<Device>,
  ) {}

  onModuleInit() {
    void this.bootstrapFromEnv();
  }

  private hash(deviceId: string, plainSecret: string): string {
    const pepper =
      this.config.get<string>('pairing.secretPepper') ?? 'dev-pepper-change-me';
    return createHash('sha256')
      .update(`${pepper}:${deviceId}:${plainSecret}`)
      .digest('hex');
  }

  private async bootstrapFromEnv(): Promise<void> {
    const raw = this.config.get<string>('pairing.bootstrapDevices') ?? '';
    if (!raw.trim()) {
      return;
    }
    for (const part of raw.split(',')) {
      const trimmed = part.trim();
      if (!trimmed) {
        continue;
      }
      const colon = trimmed.indexOf(':');
      if (colon < 1) {
        this.log.warn(`BOOTSTRAP_DEVICES: bỏ qua đoạn không hợp lệ: ${trimmed}`);
        continue;
      }
      const deviceId = trimmed.slice(0, colon).trim();
      const secret = trimmed.slice(colon + 1).trim();
      if (!deviceId || !secret) {
        continue;
      }
      await this.registerIfNotExists(deviceId, secret);
      this.log.log(`Bootstrap device đã đăng ký: ${deviceId}`);
    }
  }

  async registerIfNotExists(deviceId: string, plainSecret: string): Promise<void> {
    const exists = await this.devices.exist({ where: { deviceId } });
    if (exists) {
      return;
    }
    await this.register(deviceId, plainSecret);
  }

  async register(deviceId: string, plainSecret: string): Promise<Device> {
    const row = this.devices.create({
      deviceId,
      secretHash: this.hash(deviceId, plainSecret),
    });
    return this.devices.save(row);
  }

  async isRegistered(deviceId: string): Promise<boolean> {
    return this.devices.exist({ where: { deviceId } });
  }

  async verifyPairing(deviceId: string, plainSecret: string): Promise<boolean> {
    const row = await this.devices.findOne({ where: { deviceId } });
    if (!row) {
      return false;
    }
    return this.hash(deviceId, plainSecret) === row.secretHash;
  }
}
