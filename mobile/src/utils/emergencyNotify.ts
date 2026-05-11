import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import { AppState, Platform } from 'react-native';

/** Đổi id khi cần ép Android tạo lại kênh (stream báo động / âm lượng). */
const CHANNEL_ID = 'emergency_alarm_v2';

/** Tối đa 5 thông báo, cách 30s (hủy hết khi đã an toàn). */
const DANGER_PING_COUNT = 5;
const DANGER_PING_INTERVAL_SEC = 30;

let scheduledDangerIds: string[] = [];
let appForeground = AppState.currentState === 'active';

AppState.addEventListener('change', (state) => {
  appForeground = state === 'active';
});

function isEmergencyPayload(data: unknown): boolean {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { kind?: string }).kind === 'emergency'
  );
}

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data;
    const emergency = isEmergencyPayload(data);
    if (emergency) {
      return {
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        priority: Notifications.AndroidNotificationPriority.MAX,
      };
    }
    const bg = !appForeground;
    return {
      shouldShowBanner: bg,
      shouldShowList: bg,
      shouldPlaySound: bg,
      shouldSetBadge: false,
    };
  },
});

export { isEmergencyPayload };

export async function ensureEmergencyNotificationsReady(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }
  const { status: cur } = await Notifications.getPermissionsAsync();
  let next = cur;
  if (cur !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    next = status;
  }
  if (next !== 'granted') {
    return false;
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Báo động gas / nhiệt',
      description:
        'Âm qua loa báo thức (ưu tiên), có thể xuyên chế độ im lặng tùy máy.',
      importance: Notifications.AndroidImportance.MAX,
      bypassDnd: true,
      vibrationPattern: [0, 450, 150, 450, 150, 750],
      sound: 'default',
      enableVibrate: true,
      enableLights: true,
      lightColor: '#FF0000',
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.ALARM,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
        flags: {
          enforceAudibility: true,
          requestHardwareAudioVideoSynchronization: false,
        },
      },
    });
  }
  return true;
}

/** Hủy chuỗi nhắc định kỳ khi đã an toàn hoặc thoát nguy cơ */
export async function cancelDangerRepeatingNotification(): Promise<void> {
  for (const id of scheduledDangerIds) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      /* noop */
    }
  }
  scheduledDangerIds = [];
}

/**
 * Nền / khóa máy: tối đa 5 nhắc, mỗi nhắc sau 30s·k (k=1…5). Hủy khi chỉ số ổn định.
 * (iOS có thể làm tròn tối thiểu 60s cho một số trigger — vẫn giới hạn 5 lần.)
 */
export async function scheduleDangerRepeatingNotification(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }
  await cancelDangerRepeatingNotification();
  const ok = await ensureEmergencyNotificationsReady();
  if (!ok) {
    return;
  }

  const body =
    'Chỉ số vượt ngưỡng — mở app (tối đa 5 nhắc, mỗi 30s, dừng khi an toàn).';

  for (let k = 1; k <= DANGER_PING_COUNT; k++) {
    const seconds = DANGER_PING_INTERVAL_SEC * k;

    const trigger = (
      Platform.OS === 'android'
        ? {
            type: SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds,
            repeats: false,
            channelId: CHANNEL_ID,
          }
        : {
            type: SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds,
            repeats: false,
          }
    ) as Parameters<typeof Notifications.scheduleNotificationAsync>[0]['trigger'];

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '⚠️ Vẫn nguy cơ gas / nhiệt',
        body,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
        color: '#DC2626',
        sticky: true,
      },
      trigger,
    });
    scheduledDangerIds.push(id);
  }
}

/** Một thông báo ngay khi vừa chuyển ra nền / khóa máy lúc đang nguy hiểm */
export async function pingDangerIfNotForeground(): Promise<void> {
  if (Platform.OS === 'web' || appForeground) {
    return;
  }
  const ok = await ensureEmergencyNotificationsReady();
  if (!ok) {
    return;
  }
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '⚠️ Nguy cơ an toàn',
      body: 'Gas hoặc nhiệt vượt ngưỡng — mở app ngay.',
      sound: true,
      priority: Notifications.AndroidNotificationPriority.MAX,
      color: '#DC2626',
    },
    trigger: (Platform.OS === 'android'
      ? {
          type: SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 1,
          channelId: CHANNEL_ID,
        }
      : null) as Parameters<
      typeof Notifications.scheduleNotificationAsync
    >[0]['trigger'],
  });
}
