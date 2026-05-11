const appJson = require('./app.json');

/**
 * `EXPO_PUBLIC_EAS_PROJECT_ID`: từ https://expo.dev (Project) hoặc `eas init`
 * — cần cho getExpoPushTokenAsync / báo khi app đóng.
 * Kênh Android trùng `emergency_alarm_v2` với `expo-push.service.ts`.
 */
const ANDROID_PUSH_CHANNEL = 'emergency_alarm_v2';

module.exports = () => ({
  expo: {
    ...appJson.expo,
    plugins: [
      ...(appJson.expo.plugins ?? []),
      [
        'expo-notifications',
        {
          color: '#DC2626',
          defaultChannel: ANDROID_PUSH_CHANNEL,
          /** Info.plist: remote-notification — nhận / xử lý push khi app nền. */
          enableBackgroundRemoteNotifications: true,
        },
      ],
    ],
    extra: {
      ...(appJson.expo.extra ?? {}),
      eas: {
        projectId:
          process.env.EXPO_PUBLIC_EAS_PROJECT_ID ??
          appJson.expo?.extra?.eas?.projectId ??
          '',
      },
    },
  },
});
