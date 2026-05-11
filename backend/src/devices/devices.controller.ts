import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { DevicesService } from './devices.service';
import { ExpoPushService } from './expo-push.service';

/**
 * Đăng ký thiết bị vào "nhà" (giống thêm camera — một lần, có mã bí mật).
 * Bảo vệ bằng header x-setup-token (SETUP_TOKEN trong .env).
 */
@Controller('devices')
export class DevicesController {
  constructor(
    private readonly config: ConfigService,
    private readonly devices: DevicesService,
    private readonly expoPush: ExpoPushService,
  ) {}

  @Post('register')
  @HttpCode(201)
  async register(
    @Headers('x-setup-token') setupToken: string | undefined,
    @Body() body: RegisterDeviceDto,
  ) {
    const expected = this.config.get<string>('pairing.setupToken');
    if (!expected || setupToken !== expected) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }
    await this.devices.register(body.deviceId, body.pairingSecret);
    return { ok: true, deviceId: body.deviceId };
  }

  /** Đăng ký Expo push token để nhận cảnh báo khi app không mở / đang ngủ. */
  @Post('push-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  async registerPushToken(@Body() body: RegisterPushTokenDto) {
    const pairingEnabled =
      this.config.get<boolean>('pairing.enabled') ?? true;
    if (pairingEnabled) {
      const ok = await this.devices.verifyPairing(
        body.deviceId,
        body.pairingSecret,
      );
      if (!ok) {
        throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
      }
    }
    await this.expoPush.upsertToken(body.deviceId, body.expoPushToken);
  }
}
