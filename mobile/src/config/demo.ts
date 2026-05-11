import type { PairingCredentials } from '../storage/pairedDevice';

/** Demo / học: bỏ màn nhập mã, dùng ID & secret từ env (khớp BOOTSTRAP trên server). */
export function isSkipDevicePairing(): boolean {
  return (
    (process.env.EXPO_PUBLIC_SKIP_DEVICE_PAIRING ?? 'true').toLowerCase() ===
    'true'
  );
}

export function getDemoCredentials(): PairingCredentials {
  return {
    deviceId:
      (process.env.EXPO_PUBLIC_DEMO_DEVICE_ID ?? '').trim() ||
      'esp32-sim-01',
    pairingSecret:
      (process.env.EXPO_PUBLIC_DEMO_PAIRING_SECRET ?? '').trim() ||
      'home-secret',
  };
}
