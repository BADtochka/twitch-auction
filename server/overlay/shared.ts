export interface AuctionConfig {
  lot_title: string;
  show_lot_title: boolean;
  lot_image_path: string;
  lot_image_scale: number;
  starting_price: number;
  currency_label: string;
  top_bids_in_overlay: number;
  widgets_show_after_finished?: string[];
}

export interface Bid {
  id: string;
  username: string;
  amount: number;
  status: string;
  source: string;
  avatar_url?: string;
}

export interface AuctionState {
  config: AuctionConfig;
  bids: Bid[];
  status: string;
  timer_left_seconds: number;
}

export const AVATAR_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='20' fill='%236b3fa0'/%3E%3Ccircle cx='20' cy='15' r='7' fill='white' fill-opacity='.6'/%3E%3Cpath d='M6 36q2-10 14-10 12 0 14 10z' fill='white' fill-opacity='.6'/%3E%3C/svg%3E";

export function fmt(n: number): string {
  return n.toLocaleString('ru-RU');
}

export function fmtTime(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function scaleWidget(el: HTMLElement, designW: number, designH: number): void {
  function update() {
    const scale = Math.min(window.innerWidth / designW, window.innerHeight / designH);
    el.style.transform = `scale(${scale})`;
  }
  update();
  window.addEventListener('resize', update);
}

export type StateHandler    = (state: AuctionState) => void;
export type TickHandler     = (secs: number, status: string) => void;
export type FinishedHandler = (winner: { username: string | null; amount: number | null } | null) => void;

export function connectSSE(
  onState:    StateHandler,
  onTick?:    TickHandler,
  onFinished?: FinishedHandler
): EventSource {
  let currentStatus = 'idle';
  const es = new EventSource('/overlay/events');

  es.addEventListener('auction_state', ((e: MessageEvent) => {
    const state = JSON.parse(e.data) as AuctionState;
    currentStatus = state.status;
    onState(state);
  }) as EventListener);

  es.addEventListener('timer_tick', ((e: MessageEvent) => {
    const { seconds_left } = JSON.parse(e.data) as { seconds_left: number };
    onTick?.(seconds_left, currentStatus);
  }) as EventListener);

  es.addEventListener('auction_finished', ((e: MessageEvent) => {
    const winner = JSON.parse(e.data) as { username: string | null; amount: number | null } | null;
    currentStatus = 'finished';
    onFinished?.(winner);
  }) as EventListener);

  es.onerror = () => console.warn('[overlay] SSE reconnecting...');
  return es;
}
