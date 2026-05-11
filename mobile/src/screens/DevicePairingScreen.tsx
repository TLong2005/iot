import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { theme } from '../theme';
import type { PairingCredentials } from '../storage/pairedDevice';

type Props = {
  onComplete: (c: PairingCredentials) => void;
};

export function DevicePairingScreen({ onComplete }: Props) {
  const [deviceId, setDeviceId] = useState('');
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = () => {
    const d = deviceId.trim();
    const s = secret.trim();
    if (!d || !s) {
      setErr('Nhập đủ mã thiết bị và mã ghép nối.');
      return;
    }
    setErr(null);
    onComplete({ deviceId: d, pairingSecret: s });
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrap}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Ghép nối thiết bị</Text>
      <Text style={styles.lead}>Nhập mã do quản trị hoặc nhà cung cấp cấp.</Text>

      <Text style={styles.label}>Mã thiết bị</Text>
      <TextInput
        style={styles.input}
        value={deviceId}
        onChangeText={setDeviceId}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="bep-01"
        placeholderTextColor={theme.muted}
      />

      <Text style={styles.label}>Mã ghép nối</Text>
      <TextInput
        style={styles.input}
        value={secret}
        onChangeText={setSecret}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry={!showSecret}
        textContentType="password"
          placeholder="Mã ghép nối"
        placeholderTextColor={theme.muted}
      />

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Hiện mã ghép nối</Text>
        <Switch
          value={showSecret}
          onValueChange={setShowSecret}
          trackColor={{ false: theme.border, true: 'rgba(56,189,248,0.45)' }}
          thumbColor={showSecret ? theme.accent : theme.muted}
        />
      </View>

      {err ? <Text style={styles.err}>{err}</Text> : null}

      <Pressable style={styles.btn} onPress={submit}>
        <Text style={styles.btnText}>Vào giám sát</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: theme.bg,
    paddingHorizontal: 24,
    paddingTop: 48,
    justifyContent: 'flex-start',
  },
  title: {
    color: theme.text,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 12,
  },
  lead: {
    color: theme.muted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 28,
  },
  label: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: theme.text,
    fontSize: 16,
    marginBottom: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  toggleLabel: {
    color: theme.muted,
    fontSize: 14,
    fontWeight: '500',
  },
  err: {
    color: theme.danger,
    fontSize: 13,
    marginBottom: 12,
  },
  btn: {
    backgroundColor: theme.accent,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  btnText: {
    color: '#0b0f14',
    fontSize: 16,
    fontWeight: '700',
  },
});
