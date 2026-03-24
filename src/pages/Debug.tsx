import { RefreshCw } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useServerLogs } from '../hooks/useServerLogs';
import { useServerStatus } from '../hooks/useServerStatus';

const SERVER_PORT = import.meta.env.VITE_SERVER_PORT ?? '3000';

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}ч ${m}м ${s}с`;
  if (m > 0) return `${m}м ${s}с`;
  return `${s}с`;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

const levelColor: Record<string, string> = {
  info: 'text-zinc-300',
  warn: 'text-yellow-400',
  error: 'text-red-400',
};

export default function Debug() {
  const { status, uptime, refresh } = useServerStatus();
  const { logs } = useServerLogs(true);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const statusColor =
    status === 'connected' ? 'text-green-400' :
    status === 'disconnected' ? 'text-red-400' :
    'text-zinc-400';

  const statusLabel =
    status === 'connected' ? 'Подключён' :
    status === 'disconnected' ? 'Недоступен' :
    'Проверяю...';

  return (
    <div className="p-6 flex flex-col gap-4 h-full">
      <h2 className="text-xl font-bold shrink-0">Диагностика сервера</h2>

      {/* Server info */}
      <div className="bg-zinc-800 rounded-lg p-4 flex flex-col gap-3 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-zinc-400 text-sm">Статус</span>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${statusColor}`}>{statusLabel}</span>
            <button
              onClick={refresh}
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Обновить"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-zinc-400 text-sm">Адрес</span>
          <span className="text-zinc-200 text-sm font-mono">
            http://localhost:{SERVER_PORT}
          </span>
        </div>

        {uptime !== null && (
          <div className="flex items-center justify-between">
            <span className="text-zinc-400 text-sm">Uptime</span>
            <span className="text-zinc-200 text-sm">{formatUptime(uptime)}</span>
          </div>
        )}
      </div>

      {/* Logs */}
      <div className="flex flex-col gap-2 flex-1 min-h-0">
        <div className="flex items-center justify-between shrink-0">
          <span className="text-sm font-medium text-zinc-300">Логи сервера</span>
          <span className="text-xs text-zinc-500">{logs.length} записей</span>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto bg-zinc-900 rounded-lg p-3 font-mono text-xs">
          {logs.length === 0 ? (
            <span className="text-zinc-600">Нет записей</span>
          ) : (
            logs.map((entry, i) => (
              <div key={i} className="flex gap-2 leading-5">
                <span className="text-zinc-600 shrink-0">{formatTime(entry.ts)}</span>
                <span className={`shrink-0 w-10 ${levelColor[entry.level] ?? 'text-zinc-300'}`}>
                  {entry.level.toUpperCase()}
                </span>
                <span className={levelColor[entry.level] ?? 'text-zinc-300'}>{entry.msg}</span>
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}
