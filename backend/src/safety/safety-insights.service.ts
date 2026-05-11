import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ReadingsQueryService,
  type ReadingRow,
  type StatsResult,
} from './readings-query.service';
import { computeTrendFeatures, type TrendFeatures } from './trend-features';

@Injectable()
export class SafetyInsightsService {
  private readonly log = new Logger(SafetyInsightsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly readingsQuery: ReadingsQueryService,
  ) {}

  async generateInsight(
    deviceId: string,
    hours: number,
  ): Promise<{ text: string; source: 'openai' | 'local'; trend: TrendFeatures }> {
    const [stats, recent] = await Promise.all([
      this.readingsQuery.aggregateStats(deviceId, hours),
      this.readingsQuery.listRecent(deviceId, hours, 80),
    ]);
    const trend = computeTrendFeatures(recent, stats.thresholds);

    const apiKey = this.config.get<string>('openai.apiKey');
    if (apiKey?.length) {
      try {
        const text = await this.callOpenAi(
          stats,
          recent,
          trend,
          deviceId,
          hours,
        );
        return { text, source: 'openai', trend };
      } catch (e) {
        this.log.warn(
          `OpenAI insight failed, fallback: ${e instanceof Error ? e.message : e}`,
        );
      }
    }
    return {
      text: this.buildLocalInsight(stats, trend),
      source: 'local',
      trend,
    };
  }

  /**
   * Chat đa lượt — bắt buộc có OPENAI_API_KEY trên máy chủ.
   */
  async chat(
    deviceId: string,
    hours: number,
    messages: { role: 'user' | 'assistant'; content: string }[],
  ): Promise<string> {
    const apiKey = this.config.get<string>('openai.apiKey');
    if (!apiKey?.length) {
      throw new ServiceUnavailableException(
        'Chat cần cấu hình OPENAI_API_KEY trên máy chủ.',
      );
    }

    const [stats, recent] = await Promise.all([
      this.readingsQuery.aggregateStats(deviceId, hours),
      this.readingsQuery.listRecent(deviceId, hours, 60),
    ]);
    const trend = computeTrendFeatures(recent, stats.thresholds);
    const model = this.config.get<string>('openai.model') ?? 'gpt-4o-mini';

    const { slice, timeBlock } = this.buildRecentTailWithTime(
      recent,
      28,
      hours,
    );
    const contextPayload = {
      deviceId,
      periodHours: hours,
      thresholds: stats.thresholds,
      aggregates: {
        readingsCount: stats.readingsCount,
        emergencyPhi1Samples: stats.emergencySamples,
        alertEvents: stats.alertEvents,
        temp: stats.temp,
        gas: stats.gas,
      },
      trendFeatures: trend,
      recentSeriesTail: slice,
      timeContext: timeBlock,
    };

    const system = [
      'Bạn tư vấn phòng cháy nổ, khí dễ cháy, và xử lý khi chỉ số cảnh báo (nhiệt, gas). Trả lời tiếng Việt, súc tích, từng bước. Bối cảnh có thể là nhà, kho, bãi đỗ, khu có thiết bị pin (ví dụ xe điện) — chỉ liên hệ khi phù hợp câu hỏi; không gán mác nếu dữ liệu không cho biết vị trí.',
      'Luôn gắn ý với số liệu Context hoặc câu hỏi; tránh khuyên chung chung. Thời gian trả lời cho người dùng: chỉ giờ Việt Nam trong timeContext (không nêu UTC hay giờ nước khác).',
      'Min/max/TB là trên cửa sổ periodHours; mốc mẫu xem tailDau_gioVietNam và tailCuoi_gioVietNam.',
      'Không Markdown. Không bịa số. Không chẩn đoán y tế. Cháy khẩn: 114; gas/rò: tắt van nếu an toàn, thông gió, tránh tạo tia lửa/điện gần nguồn khí, sơ tán.',
      `Context: ${JSON.stringify(contextPayload)}`,
    ].join(' ');

    const trimmed = messages.slice(-12).map((m) => ({
      role: m.role,
      content:
        m.content.length > 4000 ? `${m.content.slice(0, 3997)}…` : m.content,
    }));

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 520,
        messages: [{ role: 'system', content: system }, ...trimmed],
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`OpenAI HTTP ${res.status}: ${t.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw new Error('Empty OpenAI response');
    }
    return this.sanitizePlainText(text);
  }

  /** Đổi ISO (DB) sang chuỗi hiển thị giờ Việt Nam cho văn bản người dùng. */
  private atIsoToVietnamLabel(iso: string | null): string | undefined {
    if (!iso) {
      return undefined;
    }
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return undefined;
    }
    return d.toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour12: false,
    });
  }

  /** Mẫu đuôi chuỗi + mốc thời gian (chỉ nhấn giờ Việt Nam cho câu trả lời). */
  private buildRecentTailWithTime(
    recent: ReadingRow[],
    tail: number,
    periodHours: number,
  ): {
    slice: {
      at: string;
      temp_avg: number;
      gas_avg: number;
      phi: number;
    }[];
    timeBlock: Record<string, string | number | undefined>;
  } {
    const sl = recent.slice(-tail).map((r) => ({
      at: r.at,
      temp_avg: Number(r.tempAvg.toFixed(2)),
      gas_avg: Number(r.gasAvg.toFixed(2)),
      phi: r.phi,
    }));
    const now = new Date();
    const mocBaoCao_gioVietNam = now.toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour12: false,
    });
    const firstAt = sl.length ? sl[0].at : null;
    const lastAt = sl.length ? sl[sl.length - 1].at : null;
    return {
      slice: sl,
      timeBlock: {
        mocBaoCao_gioVietNam,
        periodHours,
        giaiThichCuaSo: `Thống kê min/max/TB và xu hướng là trên ${periodHours} giờ lùi tính đến mốc «${mocBaoCao_gioVietNam}» (giờ Việt Nam, UTC+7). Không gộp theo ngày lịch 0h.`,
        tailDau_gioVietNam: this.atIsoToVietnamLabel(firstAt),
        tailCuoi_gioVietNam: this.atIsoToVietnamLabel(lastAt),
        quyUocTraLoi:
          'Khi viết cho người dùng chỉ dùng giờ Việt Nam như trên. Không nêu giờ UTC hay múi giờ nước khác.',
      },
    };
  }

  /** Gỡ **, dòng # tiêu đề — model vẫn đôi khi thêm markdown. */
  private sanitizePlainText(text: string): string {
    return text
      .replace(/\*\*/g, '')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private buildLocalInsight(s: StatsResult, trend: TrendFeatures): string {
    const { gas: gTh, temp: tTh } = s.thresholds;
    const lines: string[] = [];

    if (s.readingsCount === 0) {
      return [
        'Chưa có dữ liệu đo đã lưu trong khoảng thời gian này.',
        'Đảm bảo thiết bị gửi MQTT và backend đang chạy.',
      ].join('\n');
    }

    const vượtNhiệt = s.temp.max >= tTh;
    const vượtGas = s.gas.max >= gTh;
    const gầnNhiệt = !vượtNhiệt && s.temp.max >= tTh * 0.9;
    const gầnGas = !vượtGas && s.gas.max >= gTh * 0.9;

    const reportRef = new Date().toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour12: false,
    });
    lines.push(
      `Mốc báo cáo — giờ Việt Nam (UTC+7): ${reportRef}. Thống kê dưới đây trên ${s.periodHours} giờ lùi tính đến mốc đó (min/max/TB trên cả khoảng, không phải một thời điểm đơn lẻ).`,
    );
    lines.push(
      `Trong ${s.periodHours} giờ: ${s.readingsCount} điểm đo, ${s.emergencySamples} mẫu φ=1, ${s.alertEvents} sự kiện cảnh báo.`,
    );
    lines.push(
      `Nhiệt: min ${s.temp.min.toFixed(1)}°C, max ${s.temp.max.toFixed(1)}°C, TB ${s.temp.avg.toFixed(1)}°C (ngưỡng ${tTh}°C).`,
    );
    lines.push(
      `Gas: min ${s.gas.min.toFixed(1)}, max ${s.gas.max.toFixed(1)}, TB ${s.gas.avg.toFixed(1)} (ngưỡng ${gTh}).`,
    );

    if (trend.sampleCount >= 3) {
      lines.push('');
      lines.push(
        `Xu hướng (mẫu ${trend.sampleCount}, ~${trend.timeSpanHours.toFixed(1)} giờ):`,
      );
      const st = trend.temp.slopePerHour;
      const sg = trend.gas.slopePerHour;
      lines.push(
        `· Nhiệt: độ dốc ~${st.toFixed(3)}°C/giờ; ${trend.temp.spikeSteps} bước biến thiên lớn.`,
      );
      lines.push(
        `· Gas: độ dốc ~${sg.toFixed(3)}/giờ; ${trend.gas.spikeSteps} bước biến thiên lớn.`,
      );
      if (trend.temp.extrapolateCrossThresholdHours != null) {
        lines.push(
          `· Nếu giữ xu hướng nhiệt tuyến tính (tham khảo), gần ngưỡng sau ~${trend.temp.extrapolateCrossThresholdHours.toFixed(1)} giờ.`,
        );
      }
      if (trend.gas.extrapolateCrossThresholdHours != null) {
        lines.push(
          `· Nếu giữ xu hướng gas tuyến tính (tham khảo), gần ngưỡng sau ~${trend.gas.extrapolateCrossThresholdHours.toFixed(1)} giờ.`,
        );
      }
      lines.push(`(${trend.disclaimer})`);
    }

    if (vượtNhiệt) {
      lines.push(
        'Max nhiệt đạt/vượt ngưỡng — kiểm tra nguồn nhiệt, thông gió và cảm biến.',
      );
    } else if (gầnNhiệt) {
      lines.push('Nhiệt từng ≥90% ngưỡng — theo dõi sát.');
    }

    if (vượtGas) {
      lines.push(
        'Gas max đạt/vượt ngưỡng — thông gió, kiểm tra rò rỉ và vị trí cảm biến.',
      );
    } else if (gầnGas) {
      lines.push('Gas từng ≥90% ngưỡng — không bỏ qua.');
    }

    if (!vượtNhiệt && !vượtGas && !gầnNhiệt && !gầnGas) {
      lines.push('Max nhiệt và gas dưới 90% ngưỡng trong khoảng đã xét.');
    }

    if (
      trend.sampleCount >= 3 &&
      trend.temp.slopePerHour > 0.3 &&
      !vượtNhiệt
    ) {
      lines.push('Nhiệt đang tăng rõ theo mẫu — hạn chế nguồn nhiệt thừa, mở thông gió.');
    }
    if (trend.sampleCount >= 3 && trend.gas.slopePerHour > 0 && trend.gas.spikeSteps > 0 && !vượtGas) {
      lines.push('Khí/gas có lúc biến động mạnh — rà soát nguồn rò, vị trí cảm biến và thông gió.');
    }

    if (s.emergencySamples > 0 && s.emergencySamples === s.readingsCount) {
      lines.push(
        'Mọi mẫu đều φ=1 — kiểm tra cảm biến và ngưỡng cấu hình.',
      );
    }

    return lines.join('\n');
  }

  private async callOpenAi(
    s: StatsResult,
    recent: ReadingRow[],
    trend: TrendFeatures,
    deviceId: string,
    hours: number,
  ): Promise<string> {
    const apiKey = this.config.getOrThrow<string>('openai.apiKey');
    const model = this.config.get<string>('openai.model') ?? 'gpt-4o-mini';

    const system = [
      'Bạn tư vấn rủi ro cháy nổ, khí dễ cháy, nhiệt độ bất thường từ dữ liệu cảm biến (báo cáo kỹ thuật, tiếng Việt). Phạm vi áp dụng có thể là nhiều bối cảnh: khu sinh hoạt, kho, bãi đỗ, khu có thiết bị pin (ví dụ xe điện) — chỉ liên hệ khi phù hợp số liệu; không gán kiểu công trình nếu JSON không có.',
      'Độ dài ~120–180 chữ. Câu đầu phải nêu rõ phạm vi periodHours giờ lùi và mốc «mocBaoCao_gioVietNam» trong timeContext (chỉ giờ Việt Nam, không viết UTC hay giờ nước khác).',
      'Min/max/TB là trên cả cửa sổ; tailDau/tailCuoi là khoảng thời gian mẫu trong chuỗi mới nhất (giờ Việt Nam).',
      'Mỗi gợi ý hành động gắn với số (max gas, max nhiệt so ngưỡng…); không dùng câu kiểm tra chung chung.',
      'Không Markdown. Không bịa số. Rủi ro cháy/gas thực: 114; nghi rò khí: cắt nguồn an toàn, thông gió, tránh tia lửa, sơ tán.',
    ].join(' ');

    const { slice: recentSlice, timeBlock } = this.buildRecentTailWithTime(
      recent,
      24,
      hours,
    );

    const facts = {
      deviceId,
      periodHours: hours,
      thresholds_celsius_and_raw: s.thresholds,
      aggregates: {
        readingSamplesUsed: s.readingsCount,
        emergencyPhi1Samples: s.emergencySamples,
        persistedAlertEvents: s.alertEvents,
        temp_avg_series: {
          min: s.temp.min,
          max: s.temp.max,
          mean: s.temp.avg,
        },
        gas_avg_series: {
          min: s.gas.min,
          max: s.gas.max,
          mean: s.gas.avg,
        },
      },
      trendFeatures: trend,
      recentPointsOldestToNewest: recentSlice,
      timeContext: timeBlock,
    };

    const user = [
      'Báo cáo ngắn từ JSON. Phạm vi diễn giải: rủi ro cháy, khí, nhiệt (không gán cứng chỉ bếp). temp_avg/gas_avg trong điểm là TB cửa sổ theo mẫu.',
      JSON.stringify(facts, null, 0),
    ].join('\n');

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 480,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`OpenAI HTTP ${res.status}: ${t.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw new Error('Empty OpenAI response');
    }
    return this.sanitizePlainText(text);
  }
}
