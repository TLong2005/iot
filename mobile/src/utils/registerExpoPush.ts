import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { resolveSocketBaseUrl } from '../hooks/useSafetySocket';
import type { PairingCredentials } from '../storage/pairedDevice';

/**
 * Expo Go + Android: remote push / Expo push token đã bị gỡ (SDK 53+).
 * Development build (EAS) vẫn dùng được FCM.
 */
export function isRemotePushUnsupportedInExpoGo(): boolean {
  return Platform.OS === 'android' && Constants.appOwnership === 'expo';
}

function resolveEasProjectId(): string | null {
  const fromExtra = Constants.expoConfig?.extra?.eas?.projectId;
  if (fromExtra && String(fromExtra).length > 0) {
    return String(fromExtra);
  }
  const legacy = (
    Constants as { easConfig?: { projectId?: string } }
  ).easConfig?.projectId;
  if (legacy && String(legacy).length > 0) {
    return String(legacy);
  }
  return null;
}

/**
 * Gửi push token lên server để khi có cảnh báo (ngưỡng vượt) vẫn kêu/báo
 * dù app không mở — cần EAS projectId + bản build có APNs/FCM (không chỉ Expo Go tùy cấu hình).
 */
export async function registerExpoPushForPairing(
  pairing: PairingCredentials,
): Promise<void> {
  if (Platform.OS === 'web' || isRemotePushUnsupportedInExpoGo()) {
    return;
  }

  const projectId = resolveEasProjectId();
  if (!projectId) {
    if (__DEV__) {
      console.warn(
        '[push] Thiếu EAS project id — đặt EXPO_PUBLIC_EAS_PROJECT_ID hoặc extra.eas.projectId, rồi build bằng EAS (Expo Go Android không hỗ trợ remote push).',
      );
    }
    return;
  }

  const cur = await Notifications.getPermissionsAsync();
  let status = cur.status;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') {
    return;
  }

  const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({
    projectId,
  });
  if (!expoPushToken) {
    return;
  }

  const base = resolveSocketBaseUrl().replace(/\/$/, '');
  const res = await fetch(`${base}/devices/push-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId: pairing.deviceId,
      pairingSecret: pairing.pairingSecret,
      expoPushToken,
    }),
  });
  if (!res.ok && __DEV__) {
    console.warn(
      `[push] Đăng ký token thất bại: ${res.status} ${res.statusText}`,
    );
  }
}

/**
 * Đăng ký ngay + lắng nghe đổi token (APNs/FCM) để server luôn có địa chỉ mới.
 * Mỗi máy cài app (mỗi Expo token) là một dòng trên backend → cảnh báo tới tất cả.
 */
export function subscribeExpoPushForPairing(
  pairing: PairingCredentials,
): () => void {
  if (isRemotePushUnsupportedInExpoGo()) {
    return () => {};
  }
  void registerExpoPushForPairing(pairing);
  const subscription = Notifications.addPushTokenListener(() => {
    void registerExpoPushForPairing(pairing);
  });
  return () => subscription.remove();
}
