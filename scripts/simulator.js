/**
 * Giả lập ESP32: MQTTS :8883, topic sensors/safety, QoS 1, mỗi 5s.
 * Phím F: bật/tắt chế độ cháy (gas ≈ 500, nhiệt cao).
 * Phím S: một lần giả lập GAS TĂNG ĐỘT NGỘT (gas ≈ 850), không đổi chế độ timer.
 * Ctrl+C: thoát.
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const mqtt = require('mqtt');

const MQTT_URL = process.env.MQTT_URL ?? 'mqtts://localhost:8883';
const MQTT_TOPIC = process.env.MQTT_TOPIC ?? 'sensors/safety';
const DEVICE_ID = process.env.DEVICE_ID ?? 'esp32-sim-01';

const defaultCa = path.join(
  __dirname,
  '..',
  'infra',
  'mosquitto',
  'certs',
  'ca.crt',
);
const MQTT_CA_FILE = process.env.MQTT_CA_FILE ?? defaultCa;

function loadTlsOptions() {
  const opts = {
    protocolVersion: 4,
    reconnectPeriod: 4000,
    connectTimeout: 15_000,
  };

  if (fs.existsSync(MQTT_CA_FILE)) {
    opts.ca = fs.readFileSync(MQTT_CA_FILE);
    opts.rejectUnauthorized =
      (process.env.MQTT_REJECT_UNAUTHORIZED ?? 'true').toLowerCase() === 'true';
    console.log(`[TLS] CA: ${MQTT_CA_FILE}`);
  } else {
    console.warn(
      `[TLS] Không thấy CA (${MQTT_CA_FILE}) — dùng rejectUnauthorized=false (chỉ dev).`,
    );
    opts.rejectUnauthorized = false;
  }

  const cert = process.env.MQTT_CERT_FILE;
  const key = process.env.MQTT_KEY_FILE;
  if (cert && key && fs.existsSync(cert) && fs.existsSync(key)) {
    opts.cert = fs.readFileSync(cert);
    opts.key = fs.readFileSync(key);
    console.log('[TLS] Client cert/key đã nạp.');
  }

  if (process.env.MQTT_USERNAME) {
    opts.username = process.env.MQTT_USERNAME;
    opts.password = process.env.MQTT_PASSWORD ?? '';
  }

  return opts;
}

function randomNormal() {
  const temp = 25 + Math.random() * 5;
  const gas = 100 + Math.random() * 50;
  return {
    device_id: DEVICE_ID,
    temp: Math.round(temp * 10) / 10,
    gas: Math.round(gas * 10) / 10,
  };
}

function randomFire() {
  return {
    device_id: DEVICE_ID,
    temp: Math.round((55 + Math.random() * 8) * 10) / 10,
    gas: 500,
  };
}

/** Một lần push — gas đột ngột rất cao (test phản ứng app). */
function randomGasSpike() {
  return {
    device_id: DEVICE_ID,
    temp: Math.round((26 + Math.random() * 6) * 10) / 10,
    gas: 850,
  };
}

/** Bật bằng phím F; hoặc FIRE=1 / FIRE=true khi chạy không có TTY. */
let fireMode = false;

/** Phím S: publish một bản tin spike ngay (xử lý trong publishOnce). */
let spikeOnce = false;

function nextPayload() {
  const fire =
    fireMode ||
    process.env.FIRE === '1' ||
    String(process.env.FIRE).toLowerCase() === 'true';
  return fire ? randomFire() : randomNormal();
}

function publishOnce(client) {
  let body;
  if (spikeOnce) {
    spikeOnce = false;
    body = randomGasSpike();
  } else {
    body = nextPayload();
  }
  const msg = JSON.stringify(body);
  client.publish(MQTT_TOPIC, msg, { qos: 1 }, (err) => {
    if (err) {
      console.error('[MQTT] publish error:', err.message);
      return;
    }
    const tag = body.gas >= 700 ? '⚡' : body.gas >= 400 ? '🔥' : '  ';
    console.log(`${tag} [QoS1] ${MQTT_TOPIC} ${msg}`);
  });
}

function setupKeyboard() {
  if (!process.stdin.isTTY) {
    console.log(
      '(Không có TTY — không bắt phím F. Dùng: set FIRE=1 để cố định chế độ cháy.)\n',
    );
    return;
  }

  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();

  console.log('\n>>> Nhấn F: giả lập CHÁY (gas=500). Nhấn lại F: về bình thường.');
  console.log('>>> Nhấn S: một lần GAS ĐỘT NGỘT (gas≈850) — test nhảy đồng hồ / ngưỡng.');
  console.log('>>> Ctrl+C: thoát.\n');

  process.stdin.on('keypress', (_str, key) => {
    if (key.ctrl && key.name === 'c') {
      process.exit(0);
    }
    const ch = (_str || '').toLowerCase();
    if (ch === 'f') {
      fireMode = !fireMode;
      console.log(
        fireMode
          ? '🔥 FIRE MODE — gas cố định 500 (test cảnh báo App)'
          : '✓ Đã tắt fire mode — temp 25–30, gas 100–150',
      );
    }
    if (ch === 's') {
      spikeOnce = true;
      publishOnce(client);
      console.log('⚡ Đã gửi một bản tin spike (gas≈850).');
    }
  });
}

console.log('[WiFi] (giả lập) Đã kết nối AP → broker MQTT qua MQTTS');
console.log(`[Cfg] URL=${MQTT_URL} device=${DEVICE_ID}`);

const client = mqtt.connect(MQTT_URL, loadTlsOptions());

client.on('error', (err) => {
  console.error('[MQTT]', err.message);
});

client.on('connect', () => {
  console.log('[MQTT] Đã kết nối broker. Gửi mỗi 5 giây (QoS 1).\n');
  setupKeyboard();

  publishOnce(client);
  setInterval(() => publishOnce(client), 5000);
});

client.on('close', () => {
  console.log('[MQTT] Đã ngắt kết nối.');
});

process.on('SIGINT', () => {
  client.end(true, {}, () => process.exit(0));
});
