import { useCallback, useEffect, useState } from 'react';

const SERVER_PORT = import.meta.env.VITE_SERVER_PORT ?? '3000';
const LOGS_URL = `http://localhost:${SERVER_PORT}/debug/logs`;

export interface LogEntry {
  ts: number;
  level: 'info' | 'warn' | 'error';
  msg: string;
}

export function useServerLogs(enabled: boolean) {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch(LOGS_URL, { signal: AbortSignal.timeout(2000) });
      if (res.ok) setLogs(await res.json() as LogEntry[]);
    } catch {
      // server not available
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    fetch_();
    const interval = setInterval(fetch_, 2000);
    return () => clearInterval(interval);
  }, [enabled, fetch_]);

  return { logs, refresh: fetch_ };
}
