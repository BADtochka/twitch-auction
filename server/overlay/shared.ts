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

// ─── Connection state ─────────────────────────────────────────────────────────

type ConnectionListener = (connected: boolean) => void;
const connectionListeners = new Set<ConnectionListener>();

let stylesInjected = false;

function injectDisconnectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    #widget, #scene { transition: opacity 0.4s ease, filter 0.4s ease; }
    body.ws-offline #widget:not(.keep-visible), body.ws-offline #scene { opacity: 0; filter: blur(4px); pointer-events: none; }
    body.ws-offline #widget.keep-visible { opacity: 1 !important; filter: none !important; pointer-events: auto !important; }
  `;
  document.head.appendChild(style);
}

function notifyConnection(connected: boolean) {
  document.body.classList.toggle('ws-offline', !connected);
  for (const cb of connectionListeners) cb(connected);
}

/**
 * Subscribe to WebSocket connect/disconnect events.
 * Listeners are module-level and persist across reconnects.
 * Returns an unsubscribe function.
 */
export function onConnectionChange(cb: ConnectionListener): () => void {
  connectionListeners.add(cb);
  return () => connectionListeners.delete(cb);
}

// ─── WebSocket connection ─────────────────────────────────────────────────────

/**
 * Opens a WebSocket connection to /overlay/events with automatic
 * exponential-backoff reconnection (1s → 2s → 4s → … → 30s).
 *
 * Drop-in replacement for the old connectSSE — same callback signature.
 * bid_approved and bid_rejected messages are intentionally ignored;
 * widgets rely on full auction_state snapshots.
 *
 * Returns { close() } for explicit teardown (currently unused by widgets).
 */
export function connectWS(
  onState: StateHandler,
  onTick?: TickHandler,
  onFinished?: FinishedHandler
): { close(): void } {
  let ws: WebSocket | null = null;
  let delay = 1000;
  let stopped = false;
  let currentStatus = 'idle';

  injectDisconnectStyles();

  function connect() {
    if (stopped) return;
    // EventSource accepts relative URLs, but WebSocket requires an absolute ws:// URL.
    ws = new WebSocket(`ws://${location.host}/overlay/events`);

    ws.onopen = () => {
      delay = 1000;
      notifyConnection(true);
    };

    ws.onmessage = (e) => {
      let msg: { type: string; data: unknown };
      try {
        msg = JSON.parse(e.data as string) as { type: string; data: unknown };
      } catch {
        return;
      }
      switch (msg.type) {
        case 'auction_state': {
          const state = msg.data as AuctionState;
          currentStatus = state.status;
          onState(state);
          break;
        }
        case 'timer_tick': {
          const { seconds_left } = msg.data as { seconds_left: number };
          onTick?.(seconds_left, currentStatus);
          break;
        }
        case 'auction_finished': {
          const winner = msg.data as { username: string | null; amount: number | null } | null;
          currentStatus = 'finished';
          onFinished?.(winner);
          break;
        }
        // bid_approved, bid_rejected — intentionally ignored
      }
    };

    ws.onerror = () => {
      console.warn('[overlay] WS error, reconnecting...');
      // onclose fires after onerror — reconnect logic lives there
    };

    ws.onclose = () => {
      notifyConnection(false);
      if (!stopped) {
        setTimeout(connect, delay);
        delay = Math.min(delay * 2, 30_000);
      }
    };
  }

  connect();

  return {
    close() {
      stopped = true;
      ws?.close();
    },
  };
}
