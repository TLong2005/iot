import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  NotFoundException,
  Post,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SensorPayloadDto } from './dto/sensor-payload.dto';
import { SensorIngestService } from './sensor-ingest.service';

/**
 * Cùng pipeline với MQTT (`sensors/safety`): dùng khi test bằng curl/script
 * mà không cần broker.
 *
 * Bật: SENSOR_HTTP_INGEST_ENABLED=true và SENSOR_HTTP_INGEST_TOKEN=...
 * Header: x-sensor-ingest-token: <token>
 */
@Controller('safety')
export class SensorIngestController {
  constructor(
    private readonly config: ConfigService,
    private readonly ingest: SensorIngestService,
  ) {}

  @Post('sensor')
  async postSensor(
    @Headers('x-sensor-ingest-token') token: string | undefined,
    @Body() body: SensorPayloadDto,
  ) {
    const enabled =
      this.config.get<boolean>('sensorHttpIngest.enabled') ?? false;
    if (!enabled) {
      throw new NotFoundException();
    }
    const expected =
      this.config.get<string>('sensorHttpIngest.token')?.trim() ?? '';
    if (!expected || token !== expected) {
      throw new ForbiddenException('Invalid or missing ingest token');
    }

    const result = await this.ingest.ingestValidated(body);
    if (!result.ok && result.reason === 'unregistered') {
      throw new UnprocessableEntityException(
        `device_id chưa đăng ký: ${body.device_id}`,
      );
    }
    return { ok: true as const };
  }
}
