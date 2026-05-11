import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { FireCallButton } from './FireCallButton';
import { theme } from '../theme';
import { SafetyEmergencyPayload } from '../types/safety';

type Props = {
  visible: boolean;
  payload: SafetyEmergencyPayload | null;
  onDismiss: () => void;
};

export function EmergencyModal({ visible, payload, onDismiss }: Props) {
  if (!payload) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>KHẨN CẤP</Text>
          </View>
          <Text style={styles.title}>Phát hiện nguy cơ an toàn</Text>
          <Text style={styles.device}>Thiết bị: {payload.device_id}</Text>
          <View style={styles.row}>
            <View style={styles.cell}>
              <Text style={styles.cellLabel}>Nhiệt độ TB</Text>
              <Text style={styles.cellVal}>{payload.temp_avg.toFixed(1)} °C</Text>
            </View>
            <View style={styles.cell}>
              <Text style={styles.cellLabel}>Khí gas TB</Text>
              <Text style={styles.cellVal}>{payload.gas_avg.toFixed(1)}</Text>
            </View>
          </View>
          <FireCallButton variant="modal" />
          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
            onPress={onDismiss}
          >
          <Text style={styles.buttonText}>Đã xác nhận</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  panel: {
    backgroundColor: theme.surface2,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: theme.danger,
    shadowColor: '#f87171',
    shadowOpacity: 0.35,
    shadowRadius: 24,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(248,113,113,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 14,
  },
  badgeText: {
    color: theme.danger,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1,
  },
  title: {
    color: theme.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  device: {
    color: theme.muted,
    fontSize: 14,
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  cell: {
    flex: 1,
    backgroundColor: theme.bg,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cellLabel: {
    color: theme.muted,
    fontSize: 12,
    marginBottom: 6,
  },
  cellVal: {
    color: theme.text,
    fontSize: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  button: {
    backgroundColor: theme.text,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: theme.bg,
    fontSize: 16,
    fontWeight: '700',
  },
});
