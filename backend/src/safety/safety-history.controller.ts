import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DevicesService } from '../devices/devices.service';
import { AiChatDto } from './dto/ai-chat.dto';
import { PairingQueryDto } from './dto/pairing-query.dto';
import { ReadingsQueryService } from './readings-query.service';
import { SafetyInsightsService } from './safety-insights.service';

@Controller('safety/history')
export class SafetyHistoryController {
  constructor(
    private readonly devices: DevicesService,
    private readonly config: ConfigService,
    private readonly readingsQuery: ReadingsQueryService,
    private readonly insights: SafetyInsightsService,
  ) {}

  private async guard(dto: PairingQueryDto): Promise<void> {
    const pairingEnabled =
      this.config.get<boolean>('pairing.enabled') ?? true;
    if (!pairingEnabled) {
      return;
    }
    const ok = await this.devices.verifyPairing(dto.deviceId, dto.pairingSecret);
    if (!ok) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }
  }

  /** Lịch sử đo đã lưu (theo khoảng giờ) — dùng vẽ biểu đồ. */
  @Post('readings')
  async readings(@Body() dto: PairingQueryDto) {
    await this.guard(dto);
    const hours = dto.hours ?? 24;
    const limit =
      dto.limit ??
      this.config.get<number>('readings.maxQueryLimit') ??
      500;
    const items = await this.readingsQuery.listRecent(
      dto.deviceId,
      hours,
      limit,
    );
    return { hours, limit, items };
  }

  @Post('stats')
  async stats(@Body() dto: PairingQueryDto) {
    await this.guard(dto);
    const hours = dto.hours ?? 24;
    const stats = await this.readingsQuery.aggregateStats(dto.deviceId, hours);
    return stats;
  }

  /** Gợi ý phân tích + khối trend số (slope, spike, ngoại suy đơn giản). */
  @Post('insight')
  async insight(@Body() dto: PairingQueryDto) {
    await this.guard(dto);
    const hours = dto.hours ?? 24;
    const result = await this.insights.generateInsight(dto.deviceId, hours);
    return { hours, ...result };
  }

  @Post('ai-chat')
  async aiChat(@Body() dto: AiChatDto) {
    await this.guard(dto);
    const hours = dto.hours ?? 24;
    const reply = await this.insights.chat(
      dto.deviceId,
      hours,
      dto.messages,
    );
    return { hours, reply };
  }
}