import type { SafetyReadingPayload } from '../types/safety';

export type ChartPoint = {
  value: number;
  at: string;
};

/**
 * Điểm đuôi luôn cập nhật theo socket (realtime), không tạo thêm hàng loạt điểm mỗi MQTT.
 * Nếu bản ghi server mới trùng thời điểm/giá trị với live thì không nhân đôi.
 */
export function buildChartSeriesWithLiveTail(
  dbRows: { tempAvg: number; gasAvg: number; at: string }[],
  live: SafetyReadingPayload | null,
  deviceId: string,
  hours: number,
  pick: 'temp' | 'gas',
): ChartPoint[] {
  const cutoff = Date.now() - hours * 3600 * 1000;
  const base: ChartPoint[] = dbRows
    .filter((r) => new Date(r.at).getTime() >= cutoff)
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    .map((r) => ({
      value: pick === 'temp' ? r.tempAvg : r.gasAvg,
      at: r.at,
    }));

  if (!live || live.device_id !== deviceId) {
    return base;
  }

  const tailT = new Date(live.at).getTime();
  if (tailT < cutoff) {
    return base;
  }

  const tail: ChartPoint = {
    value: pick === 'temp' ? live.temp_avg : live.gas_avg,
    at: live.at,
  };

  if (base.length === 0) {
    return [tail];
  }

  const last = base[base.length - 1];
  const lastT = new Date(last.at).getTime();
  const dVal = Math.abs(tail.value - last.value);
  const dT = Math.abs(tailT - lastT);
  if (dT < 2500 && dVal < Math.max(0.5, Math.abs(last.value) * 0.02)) {
    return [...base.slice(0, -1), { ...tail }];
  }

  return [...base, tail];
}
