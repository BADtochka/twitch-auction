import { invoke } from '@tauri-apps/api/core';
import { ArrowLeft, Check, Copy, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { useAuctionStore } from '../store/auctionStore';
import {
  LotWidget,
  PriceWidget,
  TimerWidget,
  BidsWidget,
  TopBidWidget,
  WinnerWidget,
  FullWidget,
  WIDGET_DIMENSIONS,
  type WidgetId,
} from '../../server/overlay/widgets';

const SERVER_PORT = import.meta.env.VITE_SERVER_PORT ?? "3000";
const BASE = `http://localhost:${SERVER_PORT}`;

const WIDGETS = [
  { id: 'overlay'  as WidgetId, name: 'Сцена',   description: '1920×500 — все элементы', url: `${BASE}/overlay`           },
  { id: 'lot'      as WidgetId, name: 'Лот',     description: 'Изображение и название',  url: `${BASE}/overlay/lot`        },
  { id: 'price'    as WidgetId, name: 'Цена',    description: 'Начальная цена',           url: `${BASE}/overlay/price`      },
  { id: 'timer'    as WidgetId, name: 'Таймер',  description: 'Обратный отсчёт',         url: `${BASE}/overlay/timer`      },
  { id: 'bids'     as WidgetId, name: 'Ставки',  description: 'Топ ставок',              url: `${BASE}/overlay/bids`       },
  { id: 'top-bid'  as WidgetId, name: 'Лидер',    description: 'Лучшая ставка',           url: `${BASE}/overlay/top-bid`    },
  { id: 'winner'   as WidgetId, name: 'Победитель', description: 'Итоговый победитель',    url: `${BASE}/overlay/winner`     },
];

const WIDGET_COMPONENTS: Record<WidgetId, React.ReactNode> = {
  overlay:   <FullWidget />,
  lot:       <LotWidget />,
  price:     <PriceWidget />,
  timer:     <TimerWidget />,
  bids:      <BidsWidget />,
  'top-bid': <TopBidWidget />,
  winner:    <WinnerWidget />,
};

// ─── Scaled preview ───────────────────────────────────────────────────────────
// Scales a fixed-dimension widget to fill the card preview area (PREVIEW_W).

const PREVIEW_W = 210;

function ScaledPreview({ id }: { id: WidgetId }) {
  const dim = WIDGET_DIMENSIONS[id];
  const scale = PREVIEW_W / dim.w;
  const extraPad = 'extraPadBottom' in dim ? dim.extraPadBottom : 0;
  const containerH = Math.ceil((dim.h + extraPad) * scale);

  return (
    <div style={{ width: PREVIEW_W, height: containerH, overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
      <div style={{ width: dim.w, height: dim.h, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
        {WIDGET_COMPONENTS[id]}
      </div>
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

interface WidgetCardProps {
  widget: typeof WIDGETS[number];
  showAfterFinished: boolean;
  onToggleShowAfter: (checked: boolean) => void;
}

function WidgetCard({ widget, showAfterFinished, onToggleShowAfter }: WidgetCardProps) {
  const [copied, setCopied] = useState(false);

  const open = () => invoke('open_url', { url: widget.url });

  const copy = async () => {
    await navigator.clipboard.writeText(widget.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-700/60 bg-zinc-800/40 p-3.5 h-full">
      {/* Preview canvas */}
      <div className="flex-1 rounded-lg bg-zinc-950 flex items-center justify-center p-3">
        <ScaledPreview id={widget.id} />
      </div>

      {/* Info + actions */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-semibold text-sm text-white leading-none">{widget.name}</div>
          <div className="text-[11px] text-zinc-500 mt-0.5">{widget.description}</div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={open}
            className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 px-2 py-1 rounded hover:bg-zinc-700/60 transition-colors"
          >
            <ExternalLink size={11} />
            Открыть
          </button>
          <button
            onClick={copy}
            className="text-zinc-500 hover:text-zinc-300 p-1 rounded hover:bg-zinc-700/60 transition-colors"
            title="Копировать ссылку"
          >
            {copied
              ? <Check size={13} className="text-green-400" />
              : <Copy size={13} />}
          </button>
        </div>
      </div>

      {/* Show-after-finished toggle */}
      <div
        className="flex items-center gap-2 cursor-pointer select-none group"
        role="switch"
        aria-checked={showAfterFinished}
        tabIndex={0}
        onClick={() => onToggleShowAfter(!showAfterFinished)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleShowAfter(!showAfterFinished); } }}
      >
        <div className={`w-7 h-4 rounded-full transition-colors flex-shrink-0 flex items-center px-0.5 ${showAfterFinished ? 'bg-purple-600' : 'bg-zinc-700'}`}>
          <div className={`w-3 h-3 rounded-full bg-white shadow transition-transform ${showAfterFinished ? 'translate-x-3' : 'translate-x-0'}`} />
        </div>
        <span className="text-[11px] text-zinc-500 group-hover:text-zinc-400 transition-colors leading-none">
          Показывать после окончания
        </span>
      </div>

      {/* URL */}
      <div className="text-[10px] text-zinc-600 font-mono truncate leading-none">{widget.url}</div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
}

export default function Overlays({ onBack }: Props) {
  const showAfterIds = useAuctionStore((s) => s.auction?.config.widgets_show_after_finished ?? ['overlay', 'winner']);
  const setWidgetsShowAfterFinished = useAuctionStore((s) => s.setWidgetsShowAfterFinished);

  const toggle = (id: string, checked: boolean) => {
    const next = checked
      ? [...showAfterIds, id]
      : showAfterIds.filter((x) => x !== id);
    setWidgetsShowAfterFinished(next);
    invoke('set_widgets_show_after_finished', { ids: next });
  };

  return (
    <div className="p-6 pb-16 flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-zinc-400 hover:text-zinc-200 p-1 rounded hover:bg-zinc-700 transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h2 className="font-semibold text-white">Виджеты оверлея</h2>
          <p className="text-xs text-zinc-400 mt-0.5">Добавьте в OBS как Browser Source</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {WIDGETS.map((w) => (
          <WidgetCard
            key={w.id}
            widget={w}
            showAfterFinished={showAfterIds.includes(w.id)}
            onToggleShowAfter={(checked) => toggle(w.id, checked)}
          />
        ))}
      </div>
    </div>
  );
}
