import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { EmergencyModal } from '../components/EmergencyModal';
import { FireCallButton } from '../components/FireCallButton';
import { GaugeChart } from '../components/GaugeChart';
import { HistoryStatsPanel } from '../components/HistoryStatsPanel';
import { useSafetySocket } from '../hooks/useSafetySocket';
import type { PairingCredentials } from '../storage/pairedDevice';
import { theme } from '../theme';
import { SafetyEmergencyPayload } from '../types/safety';
import {
  playAlarmContinuous,
  preloadEmergencyAlarm,
  startEmergencyPulse,
  stopAlarm,
  stopEmergencyPulse,
} from '../utils/alarm';
import {
  cancelDangerRepeatingNotification,
  ensureEmergencyNotificationsReady,
  pingDangerIfNotForeground,
  scheduleDangerRepeatingNotification,
} from '../utils/emergencyNotify';
import { registerExpoPushForPairing } from '../utils/registerExpoPush';

type Props = {
  pairing: PairingCredentials;
  onChangeDevice: () => void;
  /** Demo: ẩn đổi thiết bị — chỉ đổi qua EXPO_PUBLIC_DEMO_DEVICE_ID. */
  demoNoPairing?: boolean;
};

export function MonitorScreen({
  pairing,
  onChangeDevice,
  demoNoPairing = false,
}: Props) {
  const [emergency, setEmergency] = useState<SafetyEmergencyPayload | null>(
    null,
  );
  const [showEmergency, setShowEmergency] = useState(false);
  const [silenceAlarmUntilSafe, setSilenceAlarmUntilSafe] = useState(false);

  const onEmergency = useCallback((p: SafetyEmergencyPayload) => {
    setEmergency(p);
    setShowEmergency(true);
  }, []);

  const {
    connected,
    reconnecting,
    connectError,
    paired,
    pairError,
    reading,
    socketUrl,
  } = useSafetySocket(onEmergency, { pairing });

  const pulseRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resumeAlarmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const dangerousRef = useRef(false);

  const dangerous = useMemo(() => {
    if (!reading || !paired) {
      return false;
    }
    return reading.phi === 1;
  }, [reading, paired]);

  useEffect(() => {
    dangerousRef.current = dangerous;
  }, [dangerous]);

  useEffect(() => {
    void ensureEmergencyNotificationsReady();
    void preloadEmergencyAlarm();
  }, []);

  /** Sau khi ghép socket đúng thiết bị, gửi lại push token (quyền có thể được cấp muộn). */
  useEffect(() => {
    if (!paired || Platform.OS === 'web') {
      return;
    }
    void registerExpoPushForPairing(pairing);
  }, [paired, pairing]);

  useEffect(() => {
    if (!dangerous) {
      setSilenceAlarmUntilSafe(false);
    }
  }, [dangerous]);

  useEffect(() => {
    if (resumeAlarmTimerRef.current) {
      clearTimeout(resumeAlarmTimerRef.current);
      resumeAlarmTimerRef.current = null;
    }
    if (!silenceAlarmUntilSafe) {
      return;
    }
    resumeAlarmTimerRef.current = setTimeout(() => {
      resumeAlarmTimerRef.current = null;
      if (dangerousRef.current) {
        setSilenceAlarmUntilSafe(false);
      }
    }, 30_000);
    return () => {
      if (resumeAlarmTimerRef.current) {
        clearTimeout(resumeAlarmTimerRef.current);
        resumeAlarmTimerRef.current = null;
      }
    };
  }, [silenceAlarmUntilSafe]);

  useEffect(() => {
    if (!dangerous || silenceAlarmUntilSafe) {
      stopEmergencyPulse(pulseRef.current);
      pulseRef.current = null;
      void stopAlarm();
      return;
    }
    pulseRef.current = startEmergencyPulse();
    void playAlarmContinuous();
    return () => {
      void stopAlarm();
      stopEmergencyPulse(pulseRef.current);
      pulseRef.current = null;
    };
  }, [dangerous, silenceAlarmUntilSafe]);

  useEffect(() => {
    if (Platform.OS === 'web' || !dangerous) {
      void cancelDangerRepeatingNotification();
      return;
    }
    void scheduleDangerRepeatingNotification();
  }, [dangerous]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active' && dangerousRef.current) {
        void pingDangerIfNotForeground();
      }
    });
    return () => sub.remove();
  }, []);

  const temp = reading?.temp ?? null;
  const gas = reading?.gas ?? null;
  const tempTh = reading?.thresholds.temp ?? 50;
  const gasTh = reading?.thresholds.gas ?? 300;

  const warnDetail = useMemo(() => {
    if (!reading) {
      return '';
    }
    const n = reading.sample_count ?? 0;
    return n > 0
      ? `Chỉ số trung bình (${n} đo gần nhất) vượt ngưỡng an toàn.`
      : 'Chỉ số vượt ngưỡng an toàn.';
  }, [reading]);
  const subtitle = useMemo(() => {
    if (!reading?.at) {
      return 'Đang chờ dữ liệu từ thiết bị đã ghép…';
    }
    const t = new Date(reading.at);
    const avg =
      (reading.sample_count ?? 0) > 0
        ? ` · TB ${reading.sample_count} đo: ${reading.temp_avg.toFixed(1)}°C / ${reading.gas_avg.toFixed(1)}`
        : '';
    return `Cập nhật: ${t.toLocaleTimeString()}${avg}`;
  }, [reading?.at, reading?.sample_count, reading?.temp_avg, reading?.gas_avg]);

  const pairBanner =
    pairError ??
    (connected && !paired ? 'Đang xác thực ghép nối…' : null);

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Giám sát an toàn</Text>
            <Text style={styles.sub}>{subtitle}</Text>
          </View>
          <View style={styles.conn}>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor:
                    connected && paired
                      ? theme.ok
                      : connected
                        ? theme.warn
                        : theme.muted,
                },
              ]}
            />
            <Text style={styles.connText}>
              {!connected
                ? reconnecting
                  ? 'Đang kết nối lại…'
                  : 'Mất kết nối'
                : paired
                  ? 'Đã kết nối'
                  : 'Chưa ghép'}
            </Text>
          </View>
        </View>

        <Text style={styles.device}>Thiết bị: {pairing.deviceId}</Text>

        {pairBanner ? (
          <View style={styles.pairWarn}>
            <Text style={styles.pairWarnText}>{pairBanner}</Text>
          </View>
        ) : null}

        <FireCallButton variant="primary" />

        <View style={styles.row}>
          <GaugeChart
            label="Nhiệt độ"
            value={temp}
            unit="°C"
            threshold={tempTh}
          />
          <View style={styles.gap} />
          <GaugeChart
            label="Khí gas"
            value={gas}
            unit="ADC"
            threshold={gasTh}
          />
        </View>

        <HistoryStatsPanel
          pairing={pairing}
          socketConnected={connected}
          paired={paired}
          liveReading={reading}
          liveOk={Boolean(connected && paired && reading)}
        />

        {reading && dangerous ? (
          <View style={styles.warnBanner}>
            <Text style={styles.warnText}>{warnDetail}</Text>
            <Text style={styles.mutedAlarm}>
              Còi/rung cho đến khi an toàn hoặc tạm tắt.
            </Text>
            {silenceAlarmUntilSafe ? (
              <Text style={styles.mutedAlarm}>
                Đang tạm tắt — sau 30s tiếp tục nếu vẫn nguy hiểm.
              </Text>
            ) : (
              <Pressable
                style={styles.snoozeBtn}
                onPress={() => setSilenceAlarmUntilSafe(true)}
              >
                <Text style={styles.snoozeText}>
                  Tạm tắt còi (30s)
                </Text>
              </Pressable>
            )}
          </View>
        ) : null}

        {!demoNoPairing ? (
          <Pressable style={styles.changeBtn} onPress={onChangeDevice}>
            <Text style={styles.changeBtnText}>Đổi thiết bị</Text>
          </Pressable>
        ) : null}

        {__DEV__ ? (
          <Text style={styles.footer}>Kết nối: {socketUrl}</Text>
        ) : null}
        {connectError ? (
          <Text style={styles.errHint}>{connectError}</Text>
        ) : null}
        {!connected && __DEV__ ? (
          <Text style={styles.hint}>
            Expo Go: đảm bảo điện thoại và máy chạy API cùng Wi‑Fi; có thể đặt
            EXPO_PUBLIC_SOCKET_URL trong mobile/.env.
          </Text>
        ) : null}
        {!connected && !__DEV__ && !connectError ? (
          <Text style={styles.hint}>Không kết nối được máy chủ. Kiểm tra mạng.</Text>
        ) : null}
      </ScrollView>

      <EmergencyModal
        visible={showEmergency && !!emergency}
        payload={emergency}
        onDismiss={() => {
          setShowEmergency(false);
          setSilenceAlarmUntilSafe(true);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  title: {
    color: theme.text,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  sub: {
    color: theme.muted,
    fontSize: 13,
    marginTop: 6,
  },
  conn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  connText: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  device: {
    color: theme.accent,
    fontSize: 13,
    marginBottom: 10,
    fontWeight: '600',
  },
  pairWarn: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.35)',
  },
  pairWarnText: {
    color: theme.warn,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  gap: {
    width: 14,
  },
  warnBanner: {
    marginTop: 20,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.35)',
  },
  warnText: {
    color: theme.danger,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  mutedAlarm: {
    color: theme.muted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 10,
  },
  snoozeBtn: {
    marginTop: 12,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  snoozeText: {
    color: theme.accent,
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  changeBtn: {
    marginTop: 22,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  changeBtnText: {
    color: theme.muted,
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  footer: {
    marginTop: 20,
    color: theme.muted,
    fontSize: 11,
    textAlign: 'center',
  },
  hint: {
    marginTop: 12,
    color: theme.warn,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  errHint: {
    marginTop: 8,
    color: theme.danger,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});
