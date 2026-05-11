/**
 * Gửi một bản tin giống firmware: publish JSON lên MQTT topic `sensors/safety`.
 * Backend subscribe topic này và gọi chung SensorIngestService với POST /safety/sensor (khi bật HTTP test).
 *
 * Mạch ESP: broker = IP LAN laptop (đừng localhost trên MCU). Plain = WiFiClient + 1883; MQTTS = WiFiClientSecure + 8883 + CA — đừng trộn TLS với cổng 1883.
 *
 * Chuẩn bị: device_id phải đã có trên server (vd. BOOTSTRAP_DEVICES trong .env).
 *
 * Chạy từ thư mục backend (để đọc MQTT_* giống Nest):
 *   node scripts/mqtt-publish-safety-demo.cjs
 *   node scripts/mqtt-publish-safety-demo.cjs esp32-sim-01 28 120
 *
 * Hoặc không cần broker: bật SENSOR_HTTP_INGEST_ENABLED=true, rồi node scripts/http-publish-safety-demo.cjs
 *
 * MQTT plaintext (không TLS): đặt MQTT_URL=mqtt://127.0.0.1:1883
 */
const mqtt = require('mqtt');
const fs = require('fs');
const path = require('path');

const url = process.env.MQTT_URL || 'mqtts://localhost:8883';
const topic = process.env.MQTT_TOPIC || 'sensors/safety';

const defaultCaFromBackend = path.join(
  __dirname,
  '..',
  '..',
  'infra',
  'mosquitto',
  'certs',
  'ca.crt',
);
const caFile = process.env.MQTT_CA_FILE || defaultCaFromBackend;

const deviceId = process.argv[2] || 'esp32-sim-01';
const temp = Number(process.argv[3] ?? 28);
const gas = Number(process.argv[4] ?? 120);

if (!Number.isFinite(temp) || !Number.isFinite(gas)) {
  console.error('temp và gas phải là số.');
  process.exit(1);
}

const opts = {
  protocolVersion: 4,
  connectTimeout: 10_000,
};
if (process.env.MQTT_USERNAME) {
  opts.username = process.env.MQTT_USERNAME;
  opts.password = process.env.MQTT_PASSWORD || '';
}
if (url.startsWith('mqtts://')) {
  opts.rejectUnauthorized =
    (process.env.MQTT_REJECT_UNAUTHORIZED ?? 'true').toLowerCase() === 'true';
  if (fs.existsSync(caFile)) {
    opts.ca = fs.readFileSync(caFile);
  } else {
    console.warn(
      `Không thấy CA tại ${caFile} — kết nối TLS có thể lỗi. Dùng MQTT_URL=mqtt://127.0.0.1:1883 để thử không TLS.`,
    );
  }
}

const payload = JSON.stringify({
  device_id: deviceId,
  temp,
  gas,
});

const client = mqtt.connect(url, opts);

client.on('connect', () => {
  client.publish(topic, payload, { qos: 1 }, (err) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`OK → ${topic}: ${payload}`);
    client.end();
  });
});

client.on('error', (e) => {
  console.error(e.message);
  process.exit(1);
});
