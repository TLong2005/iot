import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Expo, { type ExpoPushMessage } from 'expo-server-sdk';
import { Repository } from 'typeorm';
import { MobilePushToken } from './entities/mobile-push-token.entity';

/** Kênh Android trùng với `emergencyNotify.ts` (stream ALARM / importance MAX). */
const ANDROID_CHANNEL_ID = 'emergency_alarm_v2';

@Injectable()
export class ExpoPushService {
  private readonly log = new Logger(ExpoPushService.name);
  private readonly expo = new Expo();

  constructor(
    @InjectRepository(MobilePushToken)
    private readonly tokens: Repository<MobilePushToken>,
  ) {}

  async upsertToken(deviceId: string, expoPushToken: string): Promise<void> {
    if (!Expo.isExpoPushToken(expoPushToken)) {
      return;
    }
    const existing = await this.tokens.findOne({
      where: { expoPushToken },
    });
    if (existing) {
      existing.deviceId = deviceId;
      await this.tokens.save(existing);
      return;
    }
    await this.tokens.save(this.tokens.create({ deviceId, expoPushToken }));
  }

  async sendEmergencyToDevice(
    deviceId: string,
    opts: { tempAvg: number; gasAvg: number },
  ): Promise<void> {
    const rows = await this.tokens.find({
      where: { deviceId },
      select: ['id', 'expoPushToken'],
    });
    if (!rows.length) {
      return;
    }

    const messages: ExpoPushMessage[] = [];
    for (const row of rows) {
      if (!Expo.isExpoPushToken(row.expoPushToken)) {
        await this.tokens.delete({ id: row.id });
        continue;
      }
      messages.push({
        to: row.expoPushToken,
        sound: 'default',
        title: 'Khẩn cấp — gas / nhiệt',
        body: `Thiết bị ${deviceId}: nhiệt TB ${opts.tempAvg.toFixed(1)}°C, gas TB ${opts.gasAvg.toFixed(1)}. Mở app ngay.`,
        priority: 'high',
        /** iOS 15+: hiển thị như thông báo time-sensitive (âm + banner khi khóa máy). */
        interruptionLevel: 'time-sensitive',
        data: { deviceId, kind: 'emergency' },
        channelId: ANDROID_CHANNEL_ID,
      });
    }
    if (!messages.length) {
      return;
    }

    const chunks = this.expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        const receipts = await this.expo.sendPushNotificationsAsync(chunk);
        for (let j = 0; j < receipts.length; j++) {
          const receipt = receipts[j];
          const msg = chunk[j];
          if (receipt.status === 'error') {
            const err = receipt.details?.error;
            this.log.warn(
              `Expo push error: ${err} (…${String(msg.to).slice(-16)})`,
            );
            if (err === 'DeviceNotRegistered' || err === 'InvalidCredentials') {
              await this.tokens.delete({ expoPushToken: String(msg.to) });
            }
          }
        }
      } catch (e) {
        this.log.error(
          `sendPushNotificationsAsync: ${e instanceof Error ? e.message : e}`,
        );
      }
    }
  }
}
