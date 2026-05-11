import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import * as fs from 'fs';
import * as mqtt from 'mqtt';
import { SensorPayloadDto } from './dto/sensor-payload.dto';
import { SensorIngestService } from './sensor-ingest.service';

@Injectable()
export class MqttListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(MqttListenerService.name);
  private client: mqtt.MqttClient | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly ingest: SensorIngestService,
  ) {}

  onModuleInit() {
    const url = this.config.getOrThrow<string>('mqtt.url');
    const topic = this.config.getOrThrow<string>('mqtt.topic');
    const caFile = this.config.get<string>('mqtt.caFile');
    const certFile = this.config.get<string>('mqtt.certFile');
    const keyFile = this.config.get<string>('mqtt.keyFile');
    const rejectUnauthorized = this.config.get<boolean>(
      'mqtt.rejectUnauthorized',
    );
    const username = this.config.get<string>('mqtt.username');
    const password = this.config.get<string>('mqtt.password');

    const options: mqtt.IClientOptions = {
      protocolVersion: 4,
      reconnectPeriod: 4000,
      connectTimeout: 10_000,
      username: username || undefined,
      password: password || undefined,
      rejectUnauthorized,
    };

    if (caFile && fs.existsSync(caFile)) {
      options.ca = fs.readFileSync(caFile);
    }
    if (certFile && keyFile && fs.existsSync(certFile) && fs.existsSync(keyFile)) {
      options.cert = fs.readFileSync(certFile);
      options.key = fs.readFileSync(keyFile);
    }

    this.client = mqtt.connect(url, options);

    this.client.on('connect', () => {
      this.log.log(`MQTT connected to ${url}, subscribing ${topic} (QoS 1)`);
      this.client?.subscribe(topic, { qos: 1 }, (err: Error | null) => {
        if (err) {
          this.log.error(`Subscribe failed: ${err.message}`);
          return;
        }
        this.log.log(`Subscribed to ${topic} with QoS 1`);
      });
    });

    this.client.on('message', (t: string, payload: Buffer) => {
      if (t !== topic) {
        return;
      }
      void this.handlePayload(payload);
    });

    this.client.on('error', (err: Error) => {
      this.log.error(`MQTT error: ${err.message}`);
    });
  }

  onModuleDestroy() {
    this.client?.end(true);
    this.client = null;
  }

  private async handlePayload(payload: Buffer) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload.toString('utf8'));
    } catch {
      this.log.warn('Invalid JSON on sensors/safety');
      return;
    }
    const dto = plainToInstance(SensorPayloadDto, parsed, {
      enableImplicitConversion: true,
    });
    const errors = await validate(dto);
    if (errors.length) {
      this.log.warn(`Validation failed: ${JSON.stringify(errors)}`);
      return;
    }

    const result = await this.ingest.ingestValidated(dto);
    if (!result.ok && result.reason === 'unregistered') {
      this.log.warn(
        `MQTT bỏ qua — device_id chưa đăng ký trên server: ${dto.device_id}`,
      );
    }
  }
}
