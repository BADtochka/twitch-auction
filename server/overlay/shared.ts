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

// ─── Shared DOM builders ──────────────────────────────────────────────────────

export function createCard(bid: Bid): HTMLElement {
  const li = document.createElement('li');
  li.className     = 'bid-card';
  li.dataset.bidId = bid.id;

  const img = document.createElement('img');
  img.className = 'bid-avatar';
  img.alt = '';
  if (bid.avatar_url && bid.source !== 'manual') {
    img.src = bid.avatar_url;
    img.onerror = () => { img.onerror = null; img.src = AVATAR_PLACEHOLDER; };
  } else {
    img.src = AVATAR_PLACEHOLDER;
  }

  const name = document.createElement('span');
  name.className   = 'bid-username';
  name.textContent = bid.username;

  const pill = document.createElement('span');
  pill.className   = 'bid-amount-pill';
  pill.textContent = fmt(bid.amount);

  li.append(img, name, pill);
  return li;
}

/** Returns the nth non-removing child of container. */
export function stableAt(container: HTMLElement, idx: number): HTMLElement | null {
  let count = 0;
  for (const child of Array.from(container.children) as HTMLElement[]) {
    if (!child.classList.contains('removing')) {
      if (count === idx) return child;
      count++;
    }
  }
  return null;
}

export function renderBids(state: AuctionState, container: HTMLElement): void {
  const approved = state.bids
    .filter(b => b.status === 'approved' || b.status === 'winner')
    .sort((a, b) => b.amount - a.amount)
    .slice(0, state.config.top_bids_in_overlay);

  const allCards = new Map<string, HTMLElement>();
  for (const child of Array.from(container.children) as HTMLElement[]) {
    if (child.dataset.bidId) allCards.set(child.dataset.bidId, child);
  }

  const incoming = new Set(approved.map(b => b.id));

  for (const [id, el] of allCards) {
    if (!incoming.has(id)) {
      if (!el.classList.contains('removing')) {
        el.style.animation = '';  // clear inline override so .removing CSS animation plays
        el.classList.add('removing');
        el.addEventListener('animationend', () => el.remove(), { once: true });
      }
    } else if (el.classList.contains('removing')) {
      el.classList.remove('removing');
      el.style.animation = 'none';
    } else {
      el.style.animation = 'none';
    }
  }

  for (let i = 0; i < approved.length; i++) {
    const bid   = approved[i];
    const atPos = stableAt(container, i);
    const el    = allCards.get(bid.id);
    if (el) {
      if (atPos !== el) container.insertBefore(el, atPos ?? null);
    } else {
      container.insertBefore(createCard(bid), atPos ?? null);
    }
  }
}

export function renderTimer(textEl: HTMLElement, secs: number, status: string): void {
  textEl.textContent = fmtTime(secs);
  textEl.className   =
    status === 'paused' ? 'paused' :
    secs <= 30 && secs > 0 ? 'warning' : '';
}

/**
 * Returns an animate(to) function that count-animates an element's text
 * from its previous value to the new value using ease-out cubic.
 */
export function createCountUpAnimator(el: HTMLElement, duration = 600): (to: number) => void {
  let current = 0;
  let rafId: number | null = null;

  return function animate(to: number) {
    const from = current;
    current = to;
    if (rafId !== null) cancelAnimationFrame(rafId);
    if (!from || from === to) { el.textContent = fmt(to); return; }
    const start = performance.now();
    function tick(now: number) {
      const t     = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = fmt(Math.round(from + (to - from) * eased));
      if (t < 1) rafId = requestAnimationFrame(tick);
      else { rafId = null; el.textContent = fmt(to); }
    }
    rafId = requestAnimationFrame(tick);
  };
}

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

  injectDisconnectStyles();

  function connect() {
    if (stopped) return;
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
        case 'auction_state':
          onState(msg.data as AuctionState);
          break;
        case 'timer_tick': {
          const { seconds_left, status } = msg.data as { seconds_left: number; status: string };
          onTick?.(seconds_left, status);
          break;
        }
        case 'auction_finished':
          onFinished?.(msg.data as { username: string | null; amount: number | null } | null);
          break;
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
