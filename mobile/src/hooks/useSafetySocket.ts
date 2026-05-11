import Constants from 'expo-constants';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { isSkipDevicePairing } from '../config/demo';
import type { PairingCredentials } from '../storage/pairedDevice';
import {
  SafetyEmergencyPayload,
  SafetyReadingPayload,
} from '../types/safety';

function getLanIpFromExpo(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.manifest as { debuggerHost?: string } | null)?.debuggerHost;
  if (!hostUri || typeof hostUri !== 'string') {
    return null;
  }
  const ip = hostUri.split(':')[0]?.trim();
  if (!ip || ip === '127.0.0.1' || ip === 'localhost') {
    return null;
  }
  return ip;
}

/** Backend HTTP base (no /safety). Expo Go on a phone cannot use 127.0.0.1 = PC. */
export function resolveSocketBaseUrl(): string {
  const envRaw = (process.env.EXPO_PUBLIC_SOCKET_URL ?? '')
    .trim()
    .replace(/\/$/, '');

  const lanFromExpo = getLanIpFromExpo();
  const inferredUrl = lanFromExpo ? `http://${lanFromExpo}:3000` : null;

  const envIsLoopback =
    envRaw.length === 0 ||
    envRaw.includes('127.0.0.1') ||
    envRaw.includes('localhost');

  if (envIsLoopback && inferredUrl) {
    return inferredUrl;
  }

  if (envRaw.length > 0 && !envIsLoopback) {
    return envRaw;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000';
  }

  return 'http://127.0.0.1:3000';
}

function isPairingRequired(): boolean {
  if (isSkipDevicePairing()) {
    return false;
  }
  return (
    (process.env.EXPO_PUBLIC_PAIRING_REQUIRED ?? 'true').toLowerCase() !==
    'false'
  );
}

type Options = {
  pairing: PairingCredentials;
};

export function useSafetySocket(
  onEmergency: (payload: SafetyEmergencyPayload) => void,
  options: Options,
) {
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [paired, setPaired] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);
  const [reading, setReading] = useState<SafetyReadingPayload | null>(null);
  const emergRef = useRef(onEmergency);
  const needPair = isPairingRequired();

  useEffect(() => {
    emergRef.current = onEmergency;
  }, [onEmergency]);

  const baseUrl = resolveSocketBaseUrl();
  const { deviceId: pairDeviceId, pairingSecret } = options.pairing;

  useEffect(() => {
    const socket: Socket = io(`${baseUrl}/safety`, {
      transports: ['websocket', 'polling'],
      upgrade: true,
      rememberUpgrade: true,
      timeout: 20_000,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 10_000,
      randomizationFactor: 0.5,
    });

    const runPair = () => {
      if (!needPair) {
        setPaired(true);
        setPairError(null);
        return;
      }
      socket.emit(
        'safety:pair',
        {
          deviceId: pairDeviceId,
          pairingSecret,
        },
        (ack: { ok?: boolean; message?: string } | undefined) => {
          if (ack?.ok) {
            setPaired(true);
            setPairError(null);
          } else {
            setPaired(false);
            setPairError(ack?.message ?? 'Ghép nối thất bại');
            setReading(null);
          }
        },
      );
    };

    const onConnect = () => {
      setConnected(true);
      setReconnecting(false);
      setConnectError(null);
      setPaired(false);
      setPairError(null);
      setReading(null);
      runPair();
    };
    const onDisconnect = () => {
      setConnected(false);
      setPaired(false);
    };
    const onReconnectAttempt = () => {
      setReconnecting(true);
    };
    const onConnectError = (err: Error) => {
      setConnectError(err.message || 'Không kết nối được máy chủ');
      setConnected(false);
      setPaired(false);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect_attempt', onReconnectAttempt);
    socket.on('connect_error', onConnectError);
    socket.on('safety:reading', (payload: SafetyReadingPayload) =>
      setReading(payload),
    );
    socket.on('safety:emergency', (p: SafetyEmergencyPayload) =>
      emergRef.current(p),
    );

    return () => {
      socket.io.off('reconnect_attempt', onReconnectAttempt);
      socket.removeAllListeners();
      socket.close();
    };
  }, [baseUrl, needPair, pairDeviceId, pairingSecret]);

  return {
    connected,
    reconnecting,
    connectError,
    paired: needPair ? paired : true,
    pairError,
    reading,
    socketUrl: `${baseUrl}/safety`,
  };
}
