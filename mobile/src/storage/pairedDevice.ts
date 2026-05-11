import * as SecureStore from 'expo-secure-store';

const KEY_DEVICE = 'safety_device_id';
const KEY_SECRET = 'safety_pairing_secret';

export type PairingCredentials = {
  deviceId: string;
  pairingSecret: string;
};

export async function loadPairedDevice(): Promise<PairingCredentials | null> {
  const deviceId = await SecureStore.getItemAsync(KEY_DEVICE);
  const pairingSecret = await SecureStore.getItemAsync(KEY_SECRET);
  if (!deviceId || !pairingSecret) {
    return null;
  }
  return { deviceId, pairingSecret };
}

export async function savePairedDevice(c: PairingCredentials): Promise<void> {
  await SecureStore.setItemAsync(KEY_DEVICE, c.deviceId);
  await SecureStore.setItemAsync(KEY_SECRET, c.pairingSecret);
}

export async function clearPairedDevice(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_DEVICE);
  await SecureStore.deleteItemAsync(KEY_SECRET);
}
