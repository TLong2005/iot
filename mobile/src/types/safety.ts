export type SafetyReadingPayload = {
  device_id: string;
  /** Tức thời (một mẫu MQTT). */
  temp: number;
  gas: number;
  temp_avg: number;
  gas_avg: number;
  sample_count: number;
  phi: 0 | 1;
  thresholds: { gas: number; temp: number };
  at: string;
};

export type SafetyEmergencyPayload = {
  device_id: string;
  temp_avg: number;
  gas_avg: number;
  phi: 1;
  thresholds: { gas: number; temp: number };
  at: string;
};
