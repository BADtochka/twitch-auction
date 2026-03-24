export interface LogEntry {
  ts: number;
  level: 'info' | 'warn' | 'error';
  msg: string;
}

const MAX_ENTRIES = 300;
const entries: LogEntry[] = [];

export function log(level: LogEntry['level'], msg: string) {
  const entry: LogEntry = { ts: Date.now(), level, msg };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.shift();
  console.error(`[${level.toUpperCase()}] ${msg}`);
}

export function getLogs(): LogEntry[] {
  return [...entries];
}
