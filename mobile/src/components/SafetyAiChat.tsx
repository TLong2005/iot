import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { fetchAiChat } from '../api/safetyHistory';
import type { PairingCredentials } from '../storage/pairedDevice';
import { theme } from '../theme';

type Msg = { role: 'user' | 'assistant'; content: string };

type Props = {
  pairing: PairingCredentials;
  hours: number;
  /** Gửi chat tới API chỉ khi đã ghép và có kết nối. */
  apiEnabled?: boolean;
};

const PRESETS = [
  'Chỉ số khí/gas tăng nhanh — ưu tiên gì?',
  'Nhiệt tăng đột ngột (ví dụ gần pin/xe điện) — xử lý?',
  'Nghi rò khí: thứ tự an toàn?',
  'Ngửi khét hoặc nghi cháy — trước 114 cần gì?',
  'App báo nguy hiểm — tôi làm gì?',
] as const;

export function SafetyAiChat({
  pairing,
  hours,
  apiEnabled = true,
}: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, loading]);

  const sendWithText = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || loading || !apiEnabled) {
        if (!apiEnabled && text) {
          setErr('Cần kết nối và ghép thiết bị trước.');
        }
        return;
      }
      setErr(null);
      const pending: Msg[] = [...messages, { role: 'user', content: text }];
      setMessages(pending);
      setInput('');
      setLoading(true);
      try {
        const { reply } = await fetchAiChat(pairing, hours, pending);
        setMessages([...pending, { role: 'assistant', content: reply }]);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Lỗi');
        setMessages((m) => m.slice(0, -1));
      } finally {
        setLoading(false);
      }
    },
    [apiEnabled, hours, loading, messages, pairing],
  );

  return (
    <KeyboardAvoidingView
      style={styles.wrap}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.presetsRow}
      >
        {PRESETS.map((p) => (
          <Pressable
            key={p}
            style={[
              styles.preset,
              (loading || !apiEnabled) && styles.presetOff,
            ]}
            onPress={() => void sendWithText(p)}
            disabled={loading || !apiEnabled}
          >
            <Text style={styles.presetTxt}>{p}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        ref={scrollRef}
        style={styles.thread}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        {messages.map((m, i) => (
          <View
            key={`${i}-${m.role}-${m.content.slice(0, 8)}`}
            style={[
              styles.bubbleWrap,
              m.role === 'user' ? styles.bubbleUser : styles.bubbleAsst,
            ]}
          >
            <Text
              style={
                m.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAsst
              }
            >
              {m.content}
            </Text>
          </View>
        ))}
        {loading ? (
          <ActivityIndicator color={theme.accent} style={{ marginVertical: 8 }} />
        ) : null}
      </ScrollView>

      {err ? <Text style={styles.err}>{err}</Text> : null}

      <View style={styles.row}>
        <TextInput
          style={[styles.input, !apiEnabled && styles.inputOff]}
          value={input}
          onChangeText={setInput}
          placeholder="Câu hỏi của bạn…"
          placeholderTextColor={theme.muted}
          editable={!loading && apiEnabled}
          multiline
          maxLength={2000}
        />
        <Pressable
          style={[
            styles.send,
            (!input.trim() || loading || !apiEnabled) && styles.sendOff,
          ]}
          onPress={() => void sendWithText(input)}
          disabled={loading || !input.trim() || !apiEnabled}
        >
          <Text style={styles.sendTxt}>Gửi</Text>
        </Pressable>
      </View>
      {messages.length > 0 ? (
        <Pressable
          style={styles.clear}
          onPress={() => {
            setMessages([]);
            setErr(null);
          }}
        >
          <Text style={styles.clearTxt}>Xóa</Text>
        </Pressable>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 0,
    paddingTop: 0,
  },
  presetsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 10,
  },
  preset: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(56,189,248,0.08)',
    borderWidth: 1,
    borderColor: theme.border,
    maxWidth: 280,
  },
  presetOff: {
    opacity: 0.5,
  },
  presetTxt: {
    color: theme.text,
    fontSize: 12,
    lineHeight: 17,
  },
  thread: {
    maxHeight: 200,
    marginBottom: 8,
  },
  bubbleWrap: {
    maxWidth: '92%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 8,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(56,189,248,0.15)',
  },
  bubbleAsst: {
    alignSelf: 'flex-start',
    backgroundColor: theme.surface2,
    borderWidth: 1,
    borderColor: theme.border,
  },
  bubbleTextUser: {
    color: theme.text,
    fontSize: 13,
    lineHeight: 19,
  },
  bubbleTextAsst: {
    color: theme.text,
    fontSize: 13,
    lineHeight: 19,
  },
  err: {
    color: theme.danger,
    fontSize: 11,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 96,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: theme.text,
    fontSize: 14,
  },
  inputOff: {
    opacity: 0.55,
  },
  send: {
    backgroundColor: theme.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 2,
  },
  sendOff: {
    opacity: 0.45,
  },
  sendTxt: {
    color: '#0c0c0f',
    fontWeight: '700',
    fontSize: 14,
  },
  clear: {
    alignSelf: 'flex-end',
    paddingVertical: 6,
  },
  clearTxt: {
    color: theme.muted,
    fontSize: 12,
  },
});
