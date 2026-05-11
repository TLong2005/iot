import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PairDeviceDto } from '../devices/dto/pair-device.dto';
import { DevicesService } from '../devices/devices.service';

export type SafetyEmergencyPayload = {
  device_id: string;
  temp_avg: number;
  gas_avg: number;
  phi: 1;
  thresholds: { gas: number; temp: number };
  at: string;
};

/** Live readings after each MQTT message: instant sample + rolling averages. */
export type SafetyReadingPayload = {
  device_id: string;
  temp: number;
  gas: number;
  temp_avg: number;
  gas_avg: number;
  sample_count: number;
  phi: 0 | 1;
  thresholds: { gas: number; temp: number };
  at: string;
};

export type PairAck = {
  ok: boolean;
  message?: string;
  deviceId?: string;
  mode?: 'paired' | 'broadcast';
};

@WebSocketGateway({
  namespace: '/safety',
  cors: { origin: true },
  transports: ['websocket', 'polling'],
  pingInterval: 25000,
  pingTimeout: 20000,
  connectTimeout: 20000,
})
export class SafetyGateway implements OnGatewayInit {
  @WebSocketServer()
  server!: Server;

  private readonly log = new Logger(SafetyGateway.name);

  constructor(
    private readonly config: ConfigService,
    private readonly devices: DevicesService,
  ) {}

  afterInit() {
    this.log.log('Socket.io /safety gateway ready');
  }

  /**
   * Ghép đôi app ↔ đúng thiết bị (mã giống camera nhà).
   * Client emit sau khi connect; ACK qua callback Socket.io.
   */
  @SubscribeMessage('safety:pair')
  async handlePair(
    @MessageBody() body: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<PairAck> {
    const pairingEnabled =
      this.config.get<boolean>('pairing.enabled') ?? true;
    if (!pairingEnabled) {
      return { ok: true, mode: 'broadcast', message: 'pairing_disabled' };
    }

    const dto = plainToInstance(PairDeviceDto, body);
    const errors = await validate(dto);
    if (errors.length) {
      return { ok: false, message: 'Payload ghép nối không hợp lệ' };
    }

    const valid = await this.devices.verifyPairing(
      dto.deviceId,
      dto.pairingSecret,
    );
    if (!valid) {
      return {
        ok: false,
        message:
          'Sai mã thiết bị hoặc mã ghép nối. Chỉ dữ liệu từ thiết bị bạn đã đăng ký.',
      };
    }

    for (const room of client.rooms) {
      if (room !== client.id && room.startsWith('device:')) {
        void client.leave(room);
      }
    }
    const room = `device:${dto.deviceId}`;
    await client.join(room);
    this.log.log(`Client ${client.id} → ${room}`);
    return { ok: true, deviceId: dto.deviceId, mode: 'paired' };
  }

  private pairingOn(): boolean {
    return this.config.get<boolean>('pairing.enabled') ?? true;
  }

  emitReading(payload: SafetyReadingPayload) {
    if (this.pairingOn()) {
      this.server
        .to(`device:${payload.device_id}`)
        .emit('safety:reading', payload);
    } else {
      this.server.emit('safety:reading', payload);
    }
  }

  emitEmergency(payload: SafetyEmergencyPayload) {
    if (this.pairingOn()) {
      this.server
        .to(`device:${payload.device_id}`)
        .emit('safety:emergency', payload);
    } else {
      this.server.emit('safety:emergency', payload);
    }
  }
}
