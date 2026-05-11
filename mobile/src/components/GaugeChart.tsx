import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { theme } from '../theme';
import { ringProgress, stressColor } from '../utils/stressColor';

const SIZE = 172;
const STROKE = 11;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;
const CX = SIZE / 2;
const CY = SIZE / 2;

type Props = {
  label: string;
  value: number | null;
  unit: string;
  threshold: number;
};

export function GaugeChart({ label, value, unit, threshold }: Props) {
  const v = value ?? 0;
  const ratio = threshold > 0 ? v / threshold : 0;
  const color = stressColor(ratio);
  const progress = value === null ? 0 : ringProgress(v, threshold);
  const offset = C * (1 - progress);

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.ringWrap}>
        <Svg width={SIZE} height={SIZE}>
          <Circle
            cx={CX}
            cy={CY}
            r={R}
            stroke={theme.border}
            strokeWidth={STROKE}
            fill="none"
          />
          <Circle
            cx={CX}
            cy={CY}
            r={R}
            stroke={color}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={String(C)}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${CX} ${CY})`}
          />
        </Svg>
        <View style={styles.center} pointerEvents="none">
          <Text style={[styles.value, { color }]}>
            {value === null ? '—' : v.toFixed(1)}
          </Text>
          <Text style={styles.unit}>{unit}</Text>
        </View>
      </View>
      <Text style={styles.hint}>Ngưỡng cảnh báo: {threshold}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 160,
    backgroundColor: theme.surface,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
  },
  label: {
    color: theme.muted,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  ringWrap: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 32,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  unit: {
    color: theme.muted,
    fontSize: 12,
    marginTop: 2,
  },
  hint: {
    color: theme.muted,
    fontSize: 11,
    marginTop: 12,
  },
});
