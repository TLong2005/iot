import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { SafetyReadingPayload } from '../types/safety';
import {
  fetchAiInsight,
  fetchHistoryReadings,
  fetchHistoryStats,
  type HistoryStats,
  type InsightResult,
} from '../api/safetyHistory';
import type { PairingCredentials } from '../storage/pairedDevice';
import { theme } from '../theme';
import { buildChartSeriesWithLiveTail } from '../utils/chartSeries';
import { SimpleLineChart } from './SimpleLineChart';
import { SafetyAiChat } from './SafetyAiChat';

const HOUR_OPTIONS = [6, 24, 72] as const;
const POLL_MS = 8000;

type Props = {
  pairing: PairingCredentials;
  /** WebSocket đã nối máy chủ (khác với đã xác thực ghép thiết bị). */
  socketConnected: boolean;
  /** Đã ghép đối tượng safety:socket — cần để gọi API lịch sử / phân tích. */
  paired: boolean;
  liveReading: SafetyReadingPayload | null;
  liveOk: boolean;
};

export function HistoryStatsPanel({
  pairing,
  socketConnected,
  paired,
  liveReading,
  liveOk,
}: Props) {
  const [hours, setHours] = useState<(typeof HOUR_OPTIONS)[number]>(24);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [stats, setStats] = useState<HistoryStats | null>(null);
  const [insight, setInsight] = useState<InsightResult | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightErr, setInsightErr] = useState<string | null>(null);
  const [readings, setReadings] = useState<
    { tempAvg: number; gasAvg: number; at: string }[]
  >([]);

  const canFetch = paired && socketConnected;

  const load = useCallback(async () => {
    if (!canFetch) {
      setStats(null);
      setReadings([]);
      setErr(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const [s, r] = await Promise.all([
        fetchHistoryStats(pairing, hours),
        fetchHistoryReadings(pairing, hours),
      ]);
      setStats(s);
      setReadings(
        r.items.map((x) => ({
          tempAvg: x.tempAvg,
          gasAvg: x.gasAvg,
          at: x.at,
        })),
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Lỗi tải');
      setStats(null);
      setReadings([]);
    } finally {
      setLoading(false);
    }
  }, [canFetch, hours, pairing]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!canFetch) {
      return;
    }
    const t = setInterval(() => {
      void load();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [canFetch, load]);

  const tempSeries = useMemo(
    () =>
      buildChartSeriesWithLiveTail(
        readings,
        liveOk ? liveReading : null,
        pairing.deviceId,
        hours,
        'temp',
      ),
    [readings, liveOk, liveReading, pairing.deviceId, hours],
  );

  const gasSeries = useMemo(
    () =>
      buildChartSeriesWithLiveTail(
        readings,
        liveOk ? liveReading : null,
        pairing.deviceId,
        hours,
        'gas',
      ),
    [readings, liveOk, liveReading, pairing.deviceId, hours],
  );

  const tempThreshold =
    liveReading?.thresholds.temp ?? stats?.thresholds.temp ?? null;
  const gasThreshold =
    liveReading?.thresholds.gas ?? stats?.thresholds.gas ?? null;

  const onInsight = useCallback(async () => {
    if (!paired) {
      return;
    }
    setInsightLoading(true);
    setInsightErr(null);
    try {
      const r = await fetchAiInsight(pairing, hours);
      setInsight(r);
    } catch (e) {
      setInsightErr(e instanceof Error ? e.message : 'Lỗi AI');
    } finally {
      setInsightLoading(false);
    }
  }, [hours, paired, pairing]);

  useEffect(() => {
    setInsight(null);
    setInsightErr(null);
  }, [hours]);

  const statusBanner =
    !socketConnected
      ? 'Chưa kết nối máy chủ.'
      : !paired
        ? 'Chưa ghép thiết bị.'
        : null;

  return (
    <View style={styles.block}>
      {statusBanner ? (
        <View style={styles.panelBanner}>
          <Text style={styles.panelBannerTxt}>{statusBanner}</Text>
        </View>
      ) : null}
      {liveOk ? (
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Trực tiếp</Text>
        </View>
      ) : null}
      <View style={styles.chips}>
        {HOUR_OPTIONS.map((h) => (
          <Pressable
            key={h}
            style={[styles.chip, hours === h && styles.chipOn]}
            onPress={() => setHours(h)}
          >
            <Text style={[styles.chipTxt, hours === h && styles.chipTxtOn]}>
              {h}h
            </Text>
          </Pressable>
        ))}
        <Pressable style={styles.refresh} onPress={() => void load()}>
          <Text style={styles.refreshTxt}>Cập nhật</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.accent} style={{ marginVertical: 16 }} />
      ) : null}
      {err ? <Text style={styles.err}>{err}</Text> : null}

      {stats && !loading ? (
        <View style={styles.statsCard}>
          <Text style={styles.statsLine}>
            Điểm: {stats.readingsCount} · Nguy hiểm: {stats.emergencySamples} ·
            Cảnh báo: {stats.alertEvents}
          </Text>
          <Text style={styles.statsLine}>
            Nhiệt: min {stats.temp.min.toFixed(1)} · max{' '}
            {stats.temp.max.toFixed(1)} · TB {stats.temp.avg.toFixed(1)}°C · ngưỡng{' '}
            {stats.thresholds.temp}°C
          </Text>
          <Text style={styles.statsLine}>
            Gas: min {stats.gas.min.toFixed(1)} · max {stats.gas.max.toFixed(1)} · TB{' '}
            {stats.gas.avg.toFixed(1)} · ngưỡng {stats.thresholds.gas}
          </Text>
        </View>
      ) : null}

      <SimpleLineChart
        title="Nhiệt độ"
        unit="°C"
        data={tempSeries}
        stroke="#38bdf8"
        threshold={tempThreshold}
        windowHours={hours}
      />
      <SimpleLineChart
        title="Khí gas"
        unit="ADC"
        data={gasSeries}
        stroke="#fbbf24"
        threshold={gasThreshold}
        windowHours={hours}
      />

      <View style={styles.chatSection}>
        <SafetyAiChat
          pairing={pairing}
          hours={hours}
          apiEnabled={paired && socketConnected}
        />
      </View>

      <View style={styles.aiCard}>
        {insightErr ? <Text style={styles.err}>{insightErr}</Text> : null}
        <Pressable
          style={[styles.aiBtn, (!paired || insightLoading) && styles.aiBtnOff]}
          onPress={() => void onInsight()}
          disabled={!paired || insightLoading}
        >
          {insightLoading ? (
            <ActivityIndicator color="#0c0c0f" />
          ) : (
            <Text style={styles.aiBtnTxt}>Phân tích</Text>
          )}
        </Pressable>
        {insight ? (
          <>
            {insight.trend && insight.trend.sampleCount >= 2 ? (
              <Text style={styles.trendBox}>
                Xu hướng: nhiệt{' '}
                {insight.trend.temp.slopePerHour >= 0 ? '+' : ''}
                {insight.trend.temp.slopePerHour.toFixed(2)}°C/h · gas{' '}
                {insight.trend.gas.slopePerHour >= 0 ? '+' : ''}
                {insight.trend.gas.slopePerHour.toFixed(2)}/h
                {insight.trend.temp.extrapolateCrossThresholdHours != null
                  ? ` · ~${insight.trend.temp.extrapolateCrossThresholdHours.toFixed(1)}h tới ngưỡng`
                  : ''}
              </Text>
            ) : null}
            <Text style={styles.aiText}>{insight.text}</Text>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginTop: 24,
    paddingBottom: 8,
  },
  panelBanner: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.35)',
  },
  panelBannerTxt: {
    color: theme.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.ok,
  },
  liveText: {
    color: theme.ok,
    fontSize: 12,
    fontWeight: '600',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: theme.surface2,
    borderWidth: 1,
    borderColor: theme.border,
  },
  chipOn: {
    backgroundColor: 'rgba(56,189,248,0.2)',
    borderColor: theme.accent,
  },
  chipTxt: {
    color: theme.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTxtOn: {
    color: theme.accent,
  },
  refresh: {
    marginLeft: 'auto',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  refreshTxt: {
    color: theme.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  err: {
    color: theme.danger,
    fontSize: 12,
    marginBottom: 8,
  },
  statsCard: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.surface2,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 4,
  },
  statsLine: {
    color: theme.muted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
  },
  chatSection: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: theme.surface2,
    borderWidth: 1,
    borderColor: theme.border,
  },
  aiCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(74,222,128,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.25)',
  },
  aiBtn: {
    alignSelf: 'flex-start',
    backgroundColor: theme.ok,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  aiBtnOff: {
    opacity: 0.5,
  },
  aiBtnTxt: {
    color: '#0c0c0f',
    fontWeight: '700',
    fontSize: 14,
  },
  aiText: {
    marginTop: 10,
    color: theme.text,
    fontSize: 13,
    lineHeight: 20,
  },
  trendBox: {
    marginTop: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: theme.surface2,
    borderWidth: 1,
    borderColor: theme.border,
    color: theme.muted,
    fontSize: 11,
    lineHeight: 16,
  },
});
