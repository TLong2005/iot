import { useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { theme } from '../theme';
import type { ChartPoint } from '../utils/chartSeries';

type Props = {
  title: string;
  unit: string;
  data: ChartPoint[];
  stroke: string;
  height?: number;
  threshold?: number | null;
  /** Độ rộng trục thời gian (lùi từ «bây giờ»), khớp chip 6/24/72h. */
  windowHours: number;
};

const Y_LABEL_W = 36;
const PAD = { l: Y_LABEL_W + 6, r: 10, t: 8, b: 28 };
const MIN_CHART_W = 200;
const MAX_CHART_W = 520;

const GRID_COLOR = 'rgba(160,160,170,0.22)';
const VN_LOCALE = 'vi-VN';
const VN_TZ = { timeZone: 'Asia/Ho_Chi_Minh' } as const;

function formatXLabel(
  d: Date,
  spanMs: number,
  showDate: boolean,
): string {
  if (showDate) {
    return d.toLocaleString(VN_LOCALE, {
      ...VN_TZ,
      day: 'numeric',
      month: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
  return d.toLocaleTimeString(VN_LOCALE, {
    ...VN_TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: spanMs < 120_000 ? '2-digit' : undefined,
    hour12: false,
  });
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function buildYTicks(
  minV: number,
  maxV: number,
  innerH: number,
): { v: number; y: number }[] {
  const span = maxV - minV;
  if (!(span > 0)) {
    return [
      { v: minV, y: PAD.t + innerH },
      { v: maxV, y: PAD.t },
    ];
  }
  const target = 5;
  const rough = span / (target - 1);
  const exp = Math.floor(Math.log10(rough));
  const pow10 = 10 ** exp;
  const err = rough / pow10;
  const niceUnit = err <= 1 ? 1 : err <= 2 ? 2 : err <= 5 ? 5 : 10;
  const step = niceUnit * pow10;
  const start = Math.ceil(minV / step) * step;
  const ticks: { v: number; y: number }[] = [];
  for (let v = start; v <= maxV + step * 0.001; v += step) {
    if (v < minV - step * 0.001) {
      continue;
    }
    const yFrac = (v - minV) / (maxV - minV);
    const y = PAD.t + innerH * (1 - clamp(yFrac, 0, 1));
    ticks.push({ v, y });
  }
  if (ticks.length < 2) {
    return [
      { v: minV, y: PAD.t + innerH },
      { v: maxV, y: PAD.t },
    ];
  }
  return ticks;
}

function formatAxisValue(v: number, span: number): string {
  if (span >= 200) {
    return `${Math.round(v)}`;
  }
  if (span >= 20) {
    return v.toFixed(0);
  }
  if (span >= 2) {
    return v.toFixed(1);
  }
  return v.toFixed(2);
}

export function SimpleLineChart({
  title,
  unit,
  data,
  stroke,
  height = 188,
  threshold,
  windowHours,
}: Props) {
  const { width: winW } = useWindowDimensions();
  const [plotW, setPlotW] = useState(0);

  const onPlotLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - plotW) > 0.5) {
      setPlotW(w);
    }
  };

  const chartW = useMemo(() => {
    const w = plotW > 0 ? plotW : Math.max(winW - 64, MIN_CHART_W);
    return clamp(Math.round(w), MIN_CHART_W, MAX_CHART_W);
  }, [plotW, winW]);

  const innerW = chartW - PAD.l - PAD.r;
  const innerH = height - PAD.t - PAD.b;

  const layout = useMemo(() => {
    if (!data.length || innerW <= 0) {
      return {
        points: [] as { x: number; y: number }[],
        thrY: null as number | null,
        yTicks: [] as { v: number; y: number; lab: string }[],
        xTicks: [] as { x: number; lab: string }[],
      };
    }

    const vals = data.map((d) => d.value);
    let minV = Math.min(...vals);
    let maxV = Math.max(...vals);
    if (threshold != null && Number.isFinite(threshold)) {
      minV = Math.min(minV, threshold);
      maxV = Math.max(maxV, threshold);
    }
    if (minV === maxV) {
      minV -= 1;
      maxV += 1;
    }
    const padY = (maxV - minV) * 0.06;
    minV -= padY;
    maxV += padY;
    const spanY = maxV - minV;

    const windowEndMs = Date.now();
    const windowStartMs = windowEndMs - windowHours * 3600 * 1000;
    const spanT = Math.max(60_000, windowEndMs - windowStartMs);

    const vnDay = (ms: number) =>
      new Date(ms).toLocaleDateString(VN_LOCALE, {
        ...VN_TZ,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      });
    const showDate =
      vnDay(windowStartMs) !== vnDay(windowEndMs) || spanT > 24 * 3600 * 1000;

    let thrY: number | null = null;
    if (threshold != null && Number.isFinite(threshold)) {
      thrY =
        PAD.t + innerH * (1 - clamp((threshold - minV) / (maxV - minV), 0, 1));
    }

    const yRaw = buildYTicks(minV, maxV, innerH);
    const yTicks = yRaw.map((t) => ({
      ...t,
      lab: formatAxisValue(t.v, spanY),
    }));

    const nX = Math.min(
      5,
      Math.max(
        2,
        windowHours >= 24 ? 5 : windowHours > 6 ? 4 : 3,
      ),
    );
    const xTicks: { x: number; lab: string }[] = [];

    for (let i = 0; i < nX; i++) {
      const tMs =
        windowStartMs + (i / Math.max(1, nX - 1)) * (windowEndMs - windowStartMs);
      const xFrac = (tMs - windowStartMs) / spanT;
      const x = PAD.l + clamp(xFrac, 0, 1) * innerW;
      const d = new Date(tMs);
      const lab = formatXLabel(d, spanT, showDate);
      xTicks.push({ x, lab });
    }

    const pts = data.map((d) => {
      const t = new Date(d.at).getTime();
      const xFrac = (t - windowStartMs) / spanT;
      const x = PAD.l + clamp(xFrac, 0, 1) * innerW;
      const yFrac = (d.value - minV) / (maxV - minV);
      const y = PAD.t + innerH * (1 - clamp(yFrac, 0, 1));
      return { x, y };
    });

    return {
      points: pts,
      thrY,
      yTicks,
      xTicks,
    };
  }, [data, height, innerW, innerH, threshold, windowHours]);

  if (!data.length) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.hint}>({unit})</Text>
        <Text style={styles.empty}>Chưa có dữ liệu.</Text>
      </View>
    );
  }

  const { points, thrY, yTicks, xTicks } = layout;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>
        {title} <Text style={styles.hint}>({unit})</Text>
      </Text>
      <View style={styles.plotSlot} onLayout={onPlotLayout}>
        <Svg width={chartW} height={height}>
          {yTicks.map((tk, i) => (
            <Line
              key={`gy-${i}`}
              x1={PAD.l}
              y1={tk.y}
              x2={PAD.l + innerW}
              y2={tk.y}
              stroke={GRID_COLOR}
              strokeWidth={1}
            />
          ))}
          {xTicks.map((tk, i) => (
            <Line
              key={`gx-${i}`}
              x1={tk.x}
              y1={PAD.t}
              x2={tk.x}
              y2={PAD.t + innerH}
              stroke={GRID_COLOR}
              strokeWidth={1}
            />
          ))}
          <Line
            x1={PAD.l}
            y1={PAD.t}
            x2={PAD.l}
            y2={PAD.t + innerH}
            stroke={theme.border}
            strokeWidth={1.5}
          />
          <Line
            x1={PAD.l}
            y1={PAD.t + innerH}
            x2={PAD.l + innerW}
            y2={PAD.t + innerH}
            stroke={theme.border}
            strokeWidth={1.5}
          />
          {thrY != null ? (
            <Line
              x1={PAD.l}
              y1={thrY}
              x2={PAD.l + innerW}
              y2={thrY}
              stroke={theme.danger}
              strokeWidth={1}
              strokeDasharray="6 4"
              opacity={0.9}
            />
          ) : null}
          <Polyline
            points={points.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke={stroke}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {points.length === 1 ? (
            <Circle cx={points[0].x} cy={points[0].y} r={4} fill={stroke} />
          ) : null}
          {yTicks.map((tk, i) => (
            <SvgText
              key={`yl-${i}`}
              x={PAD.l - 6}
              y={tk.y + 4}
              fill={theme.muted}
              fontSize={9}
              textAnchor="end"
            >
              {tk.lab}
            </SvgText>
          ))}
          {xTicks.map((tk, i) => (
            <SvgText
              key={`xl-${i}`}
              x={clamp(tk.x, 22, chartW - 22)}
              y={height - 6}
              fill={theme.muted}
              fontSize={8}
              textAnchor="middle"
            >
              {tk.lab}
            </SvgText>
          ))}
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    alignSelf: 'stretch',
  },
  plotSlot: {
    width: '100%',
    alignItems: 'center',
  },
  title: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  hint: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: '400',
  },
  empty: {
    color: theme.muted,
    fontSize: 13,
  },
});
