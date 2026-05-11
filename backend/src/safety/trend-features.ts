import type { ReadingRow } from './readings-query.service';

export type SeriesTrend = {
  /** Thay đổi trung bình mỗi giờ (hồi quy tuyến tính theo thời gian). */
  slopePerHour: number;
  /** Số lần biến thiên lớn giữa hai mẫu liên tiếp (theo span chuỗi). */
  spikeSteps: number;
  /** Giờ (ước lượng) để đạt ngưỡng nếu giữ xu hướng tuyến tính; null nếu không áp dụng. */
  extrapolateCrossThresholdHours: number | null;
  lastValue: number;
};

export type TrendFeatures = {
  disclaimer: string;
  sampleCount: number;
  timeSpanHours: number;
  temp: SeriesTrend;
  gas: SeriesTrend;
};

const DISCLAIMER =
  'Dự báo xu hướng chỉ tham khảo (mẫu thưa, không thay thế cảm biến báo cháy chuyên dụng).';

function sortByTime(rows: ReadingRow[]): ReadingRow[] {
  return [...rows].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
}

function linearRegression(
  tHours: number[],
  y: number[],
): { slope: number; intercept: number } {
  const n = tHours.length;
  if (n < 2) {
    return { slope: 0, intercept: y[0] ?? 0 };
  }
  let sumT = 0;
  let sumY = 0;
  let sumTT = 0;
  let sumTY = 0;
  for (let i = 0; i < n; i++) {
    sumT += tHours[i];
    sumY += y[i];
    sumTT += tHours[i] * tHours[i];
    sumTY += tHours[i] * y[i];
  }
  const denom = n * sumTT - sumT * sumT;
  if (Math.abs(denom) < 1e-15) {
    return { slope: 0, intercept: sumY / n };
  }
  const slope = (n * sumTY - sumT * sumY) / denom;
  const intercept = (sumY - slope * sumT) / n;
  return { slope, intercept };
}

function countSpikes(ys: number[], span: number): number {
  if (ys.length < 2 || span <= 0) {
    return 0;
  }
  const thr = Math.max(span * 0.18, 1e-6);
  let n = 0;
  for (let i = 1; i < ys.length; i++) {
    if (Math.abs(ys[i] - ys[i - 1]) > thr) {
      n += 1;
    }
  }
  return n;
}

function extrapolateHoursToThreshold(params: {
  yLast: number;
  slopePerHour: number;
  threshold: number;
}): number | null {
  const { yLast, slopePerHour, threshold } = params;
  if (!(slopePerHour > 1e-9)) {
    return null;
  }
  if (yLast >= threshold) {
    return null;
  }
  const h = (threshold - yLast) / slopePerHour;
  if (!Number.isFinite(h) || h <= 0 || h > 168) {
    return null;
  }
  return h;
}

function seriesTrend(
  rows: ReadingRow[],
  key: 'tempAvg' | 'gasAvg',
  threshold: number,
): SeriesTrend {
  if (rows.length < 2) {
    return {
      slopePerHour: 0,
      spikeSteps: 0,
      extrapolateCrossThresholdHours: null,
      lastValue: rows[0]?.[key] ?? 0,
    };
  }

  const t0 = new Date(rows[0].at).getTime();
  const tHours = rows.map((r) => (new Date(r.at).getTime() - t0) / 3_600_000);
  const ys = rows.map((r) => r[key]);
  const { slope } = linearRegression(tHours, ys);
  const span = Math.max(...ys) - Math.min(...ys);
  const spikes = countSpikes(ys, span);
  const yLast = ys[ys.length - 1] ?? 0;

  return {
    slopePerHour: Number(slope.toFixed(6)),
    spikeSteps: spikes,
    extrapolateCrossThresholdHours: extrapolateHoursToThreshold({
      yLast,
      slopePerHour: slope,
      threshold,
    }),
    lastValue: Number(yLast.toFixed(4)),
  };
}

export function computeTrendFeatures(
  readings: ReadingRow[],
  thresholds: { gas: number; temp: number },
): TrendFeatures {
  const sorted = sortByTime(readings);
  const n = sorted.length;
  if (n === 0) {
    return {
      disclaimer: DISCLAIMER,
      sampleCount: 0,
      timeSpanHours: 0,
      temp: {
        slopePerHour: 0,
        spikeSteps: 0,
        extrapolateCrossThresholdHours: null,
        lastValue: 0,
      },
      gas: {
        slopePerHour: 0,
        spikeSteps: 0,
        extrapolateCrossThresholdHours: null,
        lastValue: 0,
      },
    };
  }

  const t0 = new Date(sorted[0].at).getTime();
  const t1 = new Date(sorted[n - 1].at).getTime();
  const timeSpanHours = Math.max(0, (t1 - t0) / 3_600_000);

  return {
    disclaimer: DISCLAIMER,
    sampleCount: n,
    timeSpanHours: Number(timeSpanHours.toFixed(3)),
    temp: seriesTrend(sorted, 'tempAvg', thresholds.temp),
    gas: seriesTrend(sorted, 'gasAvg', thresholds.gas),
  };
}
