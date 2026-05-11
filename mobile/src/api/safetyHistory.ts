import type { PairingCredentials } from '../storage/pairedDevice';
import { resolveSocketBaseUrl } from '../hooks/useSafetySocket';

const base = () => resolveSocketBaseUrl().replace(/\/$/, '');

async function throwIfBadResponse(res: Response, fallback: string): Promise<void> {
  let msg = fallback;
  try {
    const j = (await res.json()) as {
      message?: string | string[];
    };
    const m = j.message;
    const text = Array.isArray(m) ? m.join(', ') : m;
    if (typeof text === 'string' && text.length) {
      msg = text;
    }
  } catch {
    /* noop */
  }
  throw new Error(msg);
}

export type HistoryReading = {
  id: string;
  temp: number;
  gas: number;
  tempAvg: number;
  gasAvg: number;
  phi: number;
  at: string;
};

export type HistoryStats = {
  periodHours: number;
  readingsCount: number;
  temp: { min: number; max: number; avg: number };
  gas: { min: number; max: number; avg: number };
  emergencySamples: number;
  alertEvents: number;
  thresholds: { gas: number; temp: number };
};

export type TrendFeatures = {
  disclaimer: string;
  sampleCount: number;
  timeSpanHours: number;
  temp: {
    slopePerHour: number;
    spikeSteps: number;
    extrapolateCrossThresholdHours: number | null;
    lastValue: number;
  };
  gas: {
    slopePerHour: number;
    spikeSteps: number;
    extrapolateCrossThresholdHours: number | null;
    lastValue: number;
  };
};

export type InsightResult = {
  hours: number;
  source: 'openai' | 'local';
  text: string;
  trend: TrendFeatures;
};

export async function fetchHistoryReadings(
  pairing: PairingCredentials,
  hours: number,
): Promise<{ items: HistoryReading[]; hours: number }> {
  const res = await fetch(`${base()}/safety/history/readings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId: pairing.deviceId,
      pairingSecret: pairing.pairingSecret,
      hours,
      limit: 500,
    }),
  });
  if (res.status === 401) {
    throw new Error('Không xác thực được ghép nối.');
  }
  if (!res.ok) {
    throw new Error(`Lỗi ${res.status}`);
  }
  return res.json() as Promise<{ items: HistoryReading[]; hours: number }>;
}

export async function fetchHistoryStats(
  pairing: PairingCredentials,
  hours: number,
): Promise<HistoryStats> {
  const res = await fetch(`${base()}/safety/history/stats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId: pairing.deviceId,
      pairingSecret: pairing.pairingSecret,
      hours,
    }),
  });
  if (res.status === 401) {
    throw new Error('Không xác thực được ghép nối.');
  }
  if (!res.ok) {
    throw new Error(`Lỗi ${res.status}`);
  }
  return res.json() as Promise<HistoryStats>;
}

export async function fetchAiInsight(
  pairing: PairingCredentials,
  hours: number,
): Promise<InsightResult> {
  const res = await fetch(`${base()}/safety/history/insight`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId: pairing.deviceId,
      pairingSecret: pairing.pairingSecret,
      hours,
    }),
  });
  if (res.status === 401) {
    throw new Error('Không xác thực được ghép nối.');
  }
  if (!res.ok) {
    await throwIfBadResponse(res, `Lỗi ${res.status}`);
  }
  return res.json() as Promise<InsightResult>;
}

export async function fetchAiChat(
  pairing: PairingCredentials,
  hours: number,
  messages: { role: 'user' | 'assistant'; content: string }[],
): Promise<{ hours: number; reply: string }> {
  const res = await fetch(`${base()}/safety/history/ai-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId: pairing.deviceId,
      pairingSecret: pairing.pairingSecret,
      hours,
      messages,
    }),
  });
  if (res.status === 401) {
    throw new Error('Không xác thực được ghép nối.');
  }
  if (!res.ok) {
    await throwIfBadResponse(res, `Lỗi ${res.status}`);
  }
  return res.json() as Promise<{ hours: number; reply: string }>;
}
