import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  getFireEmergencyNumber,
  openFireEmergencyCall,
} from '../utils/fireDial';

type Props = {
  variant?: 'primary' | 'modal';
};

export function FireCallButton({ variant = 'primary' }: Props) {
  const num = getFireEmergencyNumber();
  const isModal = variant === 'modal';
  const colors = isModal
    ? (['#f87171', '#dc2626', '#991b1b'] as const)
    : (['#fb7185', '#e11d48', '#9f1239', '#881337'] as const);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.shadow,
        isModal ? styles.shadowModal : styles.shadowPrimary,
        pressed && styles.pressed,
      ]}
      onPress={() => void openFireEmergencyCall()}
      accessibilityRole="button"
      accessibilityLabel={`Gọi cứu hỏa số ${num}`}
    >
      <LinearGradient
        colors={[...colors]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.grad}
      >
        <View style={styles.iconRing}>
          <Ionicons name="call" size={isModal ? 26 : 30} color="#fff" />
        </View>
        <View style={styles.textBlock}>
          <Text style={styles.kicker}>KHẨN CẤP · PCCC</Text>
          <Text style={[styles.title, isModal && styles.titleSm]}>
            Gọi cứu hỏa
          </Text>
          <Text style={[styles.numRow, isModal && styles.numRowSm]}>
            <Text style={styles.num}>{num}</Text>
            <Text style={styles.sub}> · Số đã điền sẵn — bấm gọi</Text>
          </Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={22}
          color="rgba(255,255,255,0.75)"
          style={styles.chevron}
        />
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  shadowPrimary: {
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 12,
  },
  shadowModal: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    marginBottom: 12,
  },
  pressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.96,
  },
  grad: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 14,
    gap: 12,
  },
  iconRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  titleSm: {
    fontSize: 17,
  },
  numRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    marginTop: 6,
  },
  numRowSm: {
    marginTop: 4,
  },
  num: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  sub: {
    flex: 1,
    color: 'rgba(255,255,255,0.88)',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  chevron: {
    alignSelf: 'center',
  },
});
