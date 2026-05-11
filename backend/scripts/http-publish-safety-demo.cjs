/**
 * Gửi đo qua POST /safety/sensor — cùng pipeline với MQTT (SensorIngestService).
 * Bật SENSOR_HTTP_INGEST_ENABLED=true và đồng bộ SENSOR_HTTP_INGEST_TOKEN với .env backend.
 *
 *   node scripts/http-publish-safety-demo.cjs
 *   node scripts/http-publish-safety-demo.cjs esp32-sim-01 28 120
 */
const http = require('http');

const port = Number(process.env.HTTP_PORT || 3000);
const host = process.env.SENSOR_HTTP_HOST || '127.0.0.1';
const token = process.env.SENSOR_HTTP_INGEST_TOKEN;

const deviceId = process.argv[2] || 'esp32-sim-01';
const temp = Number(process.argv[3] ?? 28);
const gas = Number(process.argv[4] ?? 120);

if (!token) {
  console.error(
    'Thiếu SENSOR_HTTP_INGEST_TOKEN (và cần SENSOR_HTTP_INGEST_ENABLED=true trên server).',
  );
  process.exit(1);
}

if (!Number.isFinite(temp) || !Number.isFinite(gas)) {
  console.error('temp và gas phải là số.');
  process.exit(1);
}

const body = JSON.stringify({ device_id: deviceId, temp, gas });

const req = http.request(
  {
    hostname: host,
    port,
    path: '/safety/sensor',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'x-sensor-ingest-token': token,
    },
  },
  (res) => {
    let data = '';
    res.on('data', (c) => {
      data += c;
    });
    res.on('end', () => {
      if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
        console.log(`OK ${res.statusCode}: ${data || '(empty)'}`);
        return;
      }
      console.error(`Lỗi ${res.statusCode}: ${data}`);
      process.exit(1);
    });
  },
);

req.on('error', (e) => {
  console.error(e.message);
  process.exit(1);
});

req.write(body);
req.end();
