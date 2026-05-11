import { Alert, Linking, Platform } from 'react-native';

const DEFAULT_VN_FIRE = '114';

/** Số cứu hỏa Việt Nam mặc định; đổi bằng EXPO_PUBLIC_FIRE_NUMBER trong .env */
export function getFireEmergencyNumber(): string {
  const raw = (process.env.EXPO_PUBLIC_FIRE_NUMBER ?? DEFAULT_VN_FIRE).replace(
    /\D/g,
    '',
  );
  return raw.length > 0 ? raw : DEFAULT_VN_FIRE;
}

/**
 * Mở app Điện thoại của máy với số đã điền sẵn (tel:) — người dùng chỉ cần bấm gọi.
 * Không tự quay số kiểu máy nhánh cố định — đúng hành vi iOS/Android chuẩn.
 */
export async function openFireEmergencyCall(): Promise<void> {
  const n = getFireEmergencyNumber();
  const url = `tel:${n}`;
  if (Platform.OS === 'web') {
    Alert.alert(
      'Gọi cứu hỏa',
      `Trên web không gọi trực tiếp. Số: ${n}`,
    );
    return;
  }
  try {
    const can = await Linking.canOpenURL(url);
    if (!can) {
      Alert.alert(
        'Không thể gọi',
        `Không mở được ứng dụng Điện thoại. Bạn có thể gọi thủ công: ${n}`,
      );
      return;
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert('Lỗi', `Không mở được màn hình gọi. Số cứu hỏa: ${n}`);
  }
}
