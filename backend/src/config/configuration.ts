export default () => ({
  httpPort: parseInt(process.env.HTTP_PORT ?? '3000', 10),
  mqtt: {
    url: process.env.MQTT_URL ?? 'mqtts://localhost:8883',
    topic: process.env.MQTT_TOPIC ?? 'sensors/safety',
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    caFile: process.env.MQTT_CA_FILE || undefined,
    certFile: process.env.MQTT_CERT_FILE || undefined,
    keyFile: process.env.MQTT_KEY_FILE || undefined,
    rejectUnauthorized:
      (process.env.MQTT_REJECT_UNAUTHORIZED ?? 'true').toLowerCase() === 'true',
  },
  redis: {
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  db: {
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: parseInt(process.env.DB_PORT ?? '5433', 10),
    user: process.env.DB_USER || 'iot',
    password: process.env.DB_PASSWORD || 'iot_secret_change_me',
    name: process.env.DB_NAME ?? 'iot_mvp',
    sync: (process.env.DB_SYNC ?? 'false').toLowerCase() === 'true',
  },
  thresholds: {
    gas: parseFloat(process.env.THRESHOLD_GAS ?? '300'),
    temp: parseFloat(process.env.THRESHOLD_TEMP ?? '50'),
  },
  /** Min time between persisted emergency alerts per device (still emits live φ). */
  alerts: {
    cooldownMs: parseInt(process.env.ALERT_COOLDOWN_MS ?? '45000', 10),
  },
  /** Lưu một điểm vào DB tối đa mỗi N ms/thiết bị (tránh đầy DB khi MQTT dày). */
  readings: {
    persistIntervalMs: parseInt(
      process.env.READING_PERSIST_INTERVAL_MS ?? '15000',
      10,
    ),
    /** Giới hạn mỗi request lấy lịch sử (chart). */
    maxQueryLimit: parseInt(process.env.READING_QUERY_MAX ?? '500', 10),
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || undefined,
    model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  },
  /** Giống camera nhà: chỉ client đã ghép đôi mới nhận stream của đúng device_id. */
  pairing: {
    enabled: (process.env.SAFETY_PAIRING_ENABLED ?? 'true').toLowerCase() === 'true',
    setupToken: process.env.SETUP_TOKEN || undefined,
    secretPepper: process.env.DEVICE_SECRET_PEPPER || 'dev-pepper-change-me',
    /** Đăng ký sẵn: `id1:secret1,id2:secret2` (dùng cùng mã với app/ESP). */
    bootstrapDevices: process.env.BOOTSTRAP_DEVICES || '',
  },
  /** POST /safety/sensor — cùng xử lý với MQTT; tắt mặc định (chỉ bật khi test). */
  sensorHttpIngest: {
    enabled:
      (process.env.SENSOR_HTTP_INGEST_ENABLED ?? 'false').toLowerCase() ===
      'true',
    token: process.env.SENSOR_HTTP_INGEST_TOKEN?.trim() || '',
  },
});
