import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import { Platform, Vibration } from 'react-native';

let sound: Audio.Sound | null = null;
let audioModePrimed = false;

async function ensureAudioMode(): Promise<void> {
  if (audioModePrimed) {
    return;
  }
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    allowsRecordingIOS: false,
    staysActiveInBackground: false,
    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
    interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
    shouldDuckAndroid: false,
    playThroughEarpieceAndroid: false,
  });
  audioModePrimed = true;
}

/**
 * Gọi khi vào màn hình giám sát — giảm trễ khi vừa chuyển nguy hiểm (audio mode + decoder).
 */
export async function preloadEmergencyAlarm(): Promise<void> {
  try {
    await ensureAudioMode();
  } catch (e) {
    console.warn('preloadEmergencyAlarm', e);
  }
}

/**
 * Phát alarm.mp3 lặp vô hạn cho đến khi gọi `stopAlarm()` (nguy hiểm kết thúc hoặc tạm tắt).
 */
export async function playAlarmContinuous(): Promise<void> {
  await stopAlarm();
  try {
    await ensureAudioMode();
    const { sound: s } = await Audio.Sound.createAsync(
      require('../../assets/alarm.mp3'),
      { isLooping: true, volume: 1, shouldPlay: true },
    );
    sound = s;
    await s.setVolumeAsync(1).catch(() => {});
    await s.playAsync();
  } catch (e) {
    console.warn('Alarm continuous failed', e);
  }
}

/**
 * Một lần phát alarm.mp3 (không lặp) — dùng khi mở từ thông báo / modal.
 */
export async function playAlarmOnce(maxDurationMs = 120_000): Promise<void> {
  await stopAlarm();
  try {
    await ensureAudioMode();
    const { sound: s } = await Audio.Sound.createAsync(
      require('../../assets/alarm.mp3'),
      { isLooping: false, volume: 1, shouldPlay: false },
    );
    sound = s;
    await s.setVolumeAsync(1).catch(() => {});
    await s.playAsync();

    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(cap);
        void stopAlarm();
        resolve();
      };
      const cap = setTimeout(finish, maxDurationMs);
      s.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) {
          return;
        }
        if ('didJustFinish' in status && status.didJustFinish) {
          finish();
        }
      });
    });
  } catch (e) {
    console.warn('Alarm sound failed', e);
  }
}

export async function stopAlarm(): Promise<void> {
  if (!sound) {
    return;
  }
  try {
    sound.setOnPlaybackStatusUpdate(null);
    await sound.stopAsync();
    await sound.unloadAsync();
  } catch {
    /* noop */
  }
  sound = null;
}

/**
 * Rung mạnh, lặp khó chịu — Android: pattern dài; iOS: bắn nhanh.
 */
export function startEmergencyPulse(): ReturnType<typeof setInterval> | null {
  if (Platform.OS === 'android') {
    Vibration.vibrate(
      [0, 350, 80, 350, 80, 350, 80, 500, 120, 700, 120, 900],
      true,
    );
    return null;
  }
  return setInterval(() => {
    Vibration.vibrate(800);
  }, 380);
}

export function stopEmergencyPulse(
  interval: ReturnType<typeof setInterval> | null,
): void {
  Vibration.cancel();
  if (interval) {
    clearInterval(interval);
  }
}
