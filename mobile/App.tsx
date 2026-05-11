import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { useLastNotificationResponse } from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { DevicePairingScreen } from './src/screens/DevicePairingScreen';
import { MonitorScreen } from './src/screens/MonitorScreen';
import { getDemoCredentials, isSkipDevicePairing } from './src/config/demo';
import {
  clearPairedDevice,
  loadPairedDevice,
  savePairedDevice,
  type PairingCredentials,
} from './src/storage/pairedDevice';
import { theme } from './src/theme';
import {
  registerExpoPushForPairing,
  subscribeExpoPushForPairing,
} from './src/utils/registerExpoPush';
import { playAlarmOnce } from './src/utils/alarm';
import { isEmergencyPayload } from './src/utils/emergencyNotify';

export default function App() {
  const [boot, setBoot] = useState<'loading' | 'ready'>('loading');
  const [creds, setCreds] = useState<PairingCredentials | null>(null);
  const lastResponse = useLastNotificationResponse();
  const handledEmergencyAlarmIds = useRef(new Set<string>());

  /** Bấm thông báo khẩn / mở app từ thông báo → phát alarm.mp3 (to hơn âm hệ thống). */
  useEffect(() => {
    const run = (notification: Notifications.Notification) => {
      const data = notification.request.content.data;
      if (!isEmergencyPayload(data)) {
        return;
      }
      const id = notification.request.identifier;
      if (id && handledEmergencyAlarmIds.current.has(id)) {
        return;
      }
      if (id) {
        handledEmergencyAlarmIds.current.add(id);
      }
      void playAlarmOnce();
    };

    const sub =
      Notifications.addNotificationResponseReceivedListener((response) => {
        run(response.notification);
      });

    return () => sub.remove();
  }, []);

  useEffect(() => {
    const n = lastResponse?.notification;
    if (!n) {
      return;
    }
    const data = n.request.content.data;
    if (!isEmergencyPayload(data)) {
      return;
    }
    const id = n.request.identifier;
    if (id && handledEmergencyAlarmIds.current.has(id)) {
      return;
    }
    if (id) {
      handledEmergencyAlarmIds.current.add(id);
    }
    void playAlarmOnce();
  }, [lastResponse]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isSkipDevicePairing()) {
        if (!cancelled) {
          setCreds(getDemoCredentials());
          setBoot('ready');
        }
        return;
      }
      const p = await loadPairedDevice();
      if (!cancelled) {
        setCreds(p);
        setBoot('ready');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (boot !== 'ready' || !creds || Platform.OS === 'web') {
      return;
    }
    const removePushSub = subscribeExpoPushForPairing(creds);
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        void registerExpoPushForPairing(creds);
      }
    });
    return () => {
      removePushSub();
      sub.remove();
    };
  }, [boot, creds]);

  const handlePaired = async (c: PairingCredentials) => {
    await savePairedDevice(c);
    setCreds(c);
  };

  const handleChangeDevice = async () => {
    if (isSkipDevicePairing()) {
      return;
    }
    await clearPairedDevice();
    setCreds(null);
  };

  if (boot === 'loading') {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.loading}>
          <StatusBar style="light" />
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={styles.loadingText}>Đang tải…</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
        <StatusBar style="light" />
        {!creds ? (
          <DevicePairingScreen onComplete={handlePaired} />
        ) : (
          <MonitorScreen
            pairing={creds}
            onChangeDevice={handleChangeDevice}
            demoNoPairing={isSkipDevicePairing()}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  loading: {
    flex: 1,
    backgroundColor: theme.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: theme.muted,
    fontSize: 14,
  },
});
