import { useEffect, useState, useCallback } from 'react';

const SERVER_PORT = import.meta.env.VITE_SERVER_PORT ?? '3000';
const HEALTH_URL = `http://localhost:${SERVER_PORT}/health`;

export type ServerStatus = 'checking' | 'connected' | 'disconnected';

export function useServerStatus() {
  const [status, setStatus] = useState<ServerStatus>('checking');
  const [uptime, setUptime] = useState<number | null>(null);

  const check = useCallback(async () => {
    try {
      const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data = await res.json() as { ok: boolean; uptime: number };
        setStatus('connected');
        setUptime(data.uptime ?? null);
      } else {
        setStatus('disconnected');
        setUptime(null);
      }
    } catch {
      setStatus('disconnected');
      setUptime(null);
    }
  }, []);

  useEffect(() => {
    check();
    const interval = setInterval(check, 3000);
    return () => clearInterval(interval);
  }, [check]);

  return { status, uptime, refresh: check };
}
