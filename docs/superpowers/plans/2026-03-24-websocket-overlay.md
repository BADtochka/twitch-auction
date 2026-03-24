# WebSocket Overlay Transport + Connection Widget — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace SSE overlay transport with WebSocket and add a new `/overlay/connection` status widget.

**Architecture:** `WSBroadcaster` (Elysia `.ws()` on the server) replaces `SSEBroadcaster`; `connectWS()` with exponential-backoff reconnection replaces `connectSSE()` in the overlay client; `onConnectionChange()` exposes connection state for the new 8th widget.

**Tech Stack:** Bun/Elysia 1.4 (built-in `.ws()`), TypeScript, React (Overlays page preview only), Zustand (untouched)

**Spec:** `docs/superpowers/specs/2026-03-24-websocket-overlay-design.md`

---

## File Map

| File | Action |
|------|--------|
| `server/src/overlay/ws.ts` | Create — `WSBroadcaster` |
| `server/src/overlay/sse.ts` | Delete (Task 8) |
| `server/src/routes/overlay.ts` | Modify — SSE GET → WS route |
| `server/src/index.ts` | Modify — `SSEBroadcaster` → `WSBroadcaster` |
| `server/overlay/shared.ts` | Modify — replace `connectSSE` with `connectWS` + `onConnectionChange` |
| `server/overlay/index.ts` | Modify — `connectSSE` → `connectWS` |
| `server/overlay/lot.ts` | Modify — `connectSSE` → `connectWS` |
| `server/overlay/price.ts` | Modify — `connectSSE` → `connectWS` |
| `server/overlay/timer.ts` | Modify — `connectSSE` → `connectWS` |
| `server/overlay/bids.ts` | Modify — `connectSSE` → `connectWS` |
| `server/overlay/top-bid.ts` | Modify — `connectSSE` → `connectWS` |
| `server/overlay/winner.ts` | Modify — `connectSSE` → `connectWS` |
| `server/overlay/connection.html` | Create |
| `server/overlay/connection.ts` | Create |
| `server/overlay/connection.css` | Create |
| `server/overlay/widgets.tsx` | Modify — add `ConnectionWidget` + `WIDGET_DIMENSIONS` entry |
| `server/scripts/bundle-assets.ts` | Modify — add `"connection"` to `WIDGETS` array |
| `src/pages/Overlays.tsx` | Modify — add widget entry + component + suppress toggle |

---

## Task 1: Create WSBroadcaster

**Files:**
- Create: `server/src/overlay/ws.ts`

- [ ] **Step 1: Create the file**

```typescript
// server/src/overlay/ws.ts

// Minimal interface satisfied by ElysiaWS (and ServerWebSocket directly).
// Avoids importing the complex generic ElysiaWS<Context, Route> type.
interface Sendable {
  send(data: string): unknown;
}

export class WSBroadcaster {
  private clients = new Set<Sendable>();
  private lastState: unknown = null;

  setInitialState(state: unknown) {
    this.lastState = state;
  }

  add(ws: Sendable) {
    this.clients.add(ws);
    if (this.lastState !== null) {
      try {
        ws.send(JSON.stringify({ type: 'auction_state', data: this.lastState }));
      } catch {
        // client already gone
      }
    }
  }

  remove(ws: Sendable) {
    this.clients.delete(ws);
  }

  broadcast(type: string, data: unknown) {
    if (type === 'auction_state') {
      this.lastState = data;
    }
    const payload = JSON.stringify({ type, data });
    for (const ws of this.clients) {
      try {
        ws.send(payload);
      } catch {
        this.clients.delete(ws);
      }
    }
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
bun run --cwd server typecheck
```

Expected: no errors (new file, nothing imports it yet)

- [ ] **Step 3: Commit**

```bash
git add server/src/overlay/ws.ts
git commit -m "feat: add WSBroadcaster for WebSocket overlay transport"
```

---

## Task 2: Wire WSBroadcaster into route and index

**Files:**
- Modify: `server/src/routes/overlay.ts`
- Modify: `server/src/index.ts`

- [ ] **Step 1: Rewrite `server/src/routes/overlay.ts`**

Replace the entire file content:

```typescript
import { Elysia } from 'elysia';
import { WSBroadcaster } from '../overlay/ws';
import { serveOverlay } from '../overlay/assets';
import { log } from '../logger';

export function createOverlayRoutes(broadcaster: WSBroadcaster) {
  return new Elysia()
    .ws('/overlay/events', {
      open(ws) {
        log('info', 'WS client connected');
        broadcaster.add(ws);
      },
      message() {
        // overlay clients are read-only
      },
      close(ws) {
        broadcaster.remove(ws);
      },
    })
    .get('/overlay', () => serveOverlay('index.html'))
    .get('/overlay/', () => serveOverlay('index.html'))
    .get('/overlay/*', ({ request }) => {
      const filename = decodeURIComponent(
        new URL(request.url).pathname.slice('/overlay/'.length)
      );
      log('info', `overlay asset: ${filename}`);
      return serveOverlay(filename);
    });
}
```

- [ ] **Step 2: Update `server/src/index.ts`** — swap `SSEBroadcaster` for `WSBroadcaster` and rename call sites

Change line 3:
```typescript
// Before:
import { SSEBroadcaster } from './overlay/sse';
// After:
import { WSBroadcaster } from './overlay/ws';
```

Change line 12:
```typescript
// Before:
const broadcaster = new SSEBroadcaster();
// After:
const broadcaster = new WSBroadcaster();
```

In `handleRustMessage`, replace all `broadcaster.send(` → `broadcaster.broadcast(` (5 occurrences, lines ~73–81). The method was renamed from `send` to `broadcast` in `WSBroadcaster`. After the change these lines look like:
```typescript
case 'overlay:state': {
  broadcaster.broadcast('auction_state', m.data);
  // ...
}
case 'bid:approved':     broadcaster.broadcast('bid_approved',   m.data); break;
case 'bid:rejected':     broadcaster.broadcast('bid_rejected',   m.data); break;
case 'timer:tick':       broadcaster.broadcast('timer_tick',     m.data); break;
case 'auction:finished': broadcaster.broadcast('auction_finished', m.data); break;
```

- [ ] **Step 3: Typecheck**

```bash
bun run --cwd server typecheck
```

Expected: no errors — `sse.ts` still exists but is simply no longer imported.

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/overlay.ts server/src/index.ts
git commit -m "feat: switch overlay route from SSE to WebSocket"
```

---

## Task 3: Replace connectSSE with connectWS in shared.ts and all 7 overlay widgets

This is one atomic commit because removing `connectSSE` from `shared.ts` immediately breaks all 7 importers.

**Files:**
- Modify: `server/overlay/shared.ts`
- Modify: `server/overlay/index.ts`
- Modify: `server/overlay/lot.ts`
- Modify: `server/overlay/price.ts`
- Modify: `server/overlay/timer.ts`
- Modify: `server/overlay/bids.ts`
- Modify: `server/overlay/top-bid.ts`
- Modify: `server/overlay/winner.ts`

- [ ] **Step 1: Rewrite `server/overlay/shared.ts`**

Replace the entire file:

```typescript
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

function notifyConnection(connected: boolean) {
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

  function connect() {
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
```

- [ ] **Step 2: Update all 7 overlay widget files**

In each file below, replace `connectSSE` with `connectWS` everywhere it appears (both the import and the call site). No other changes needed.

**`server/overlay/index.ts`** — line 1:
```typescript
// Before:
import { connectSSE, fmt, fmtTime, AVATAR_PLACEHOLDER } from './shared.js';
// After:
import { connectWS, fmt, fmtTime, AVATAR_PLACEHOLDER } from './shared.js';
```
Line 192: `connectSSE(` → `connectWS(`

**`server/overlay/lot.ts`** — line 1:
```typescript
// Before:
import { connectSSE, scaleWidget } from './shared.js';
// After:
import { connectWS, scaleWidget } from './shared.js';
```
Line 23: `connectSSE(` → `connectWS(`

**`server/overlay/price.ts`** — line 1:
```typescript
// Before:
import { connectSSE, scaleWidget, fmt } from './shared.js';
// After:
import { connectWS, scaleWidget, fmt } from './shared.js';
```
Line 12: `connectSSE(` → `connectWS(`

**`server/overlay/timer.ts`** — line 1:
```typescript
// Before:
import { connectSSE, scaleWidget, fmtTime } from './shared.js';
// After:
import { connectWS, scaleWidget, fmtTime } from './shared.js';
```
Line 19: `connectSSE(` → `connectWS(`

**`server/overlay/bids.ts`** — line 1:
```typescript
// Before:
import { connectSSE, scaleWidget, fmt, AVATAR_PLACEHOLDER } from './shared.js';
// After:
import { connectWS, scaleWidget, fmt, AVATAR_PLACEHOLDER } from './shared.js';
```
Line 65: `connectSSE(` → `connectWS(`

**`server/overlay/top-bid.ts`** — line 1:
```typescript
// Before:
import { connectSSE, scaleWidget, fmt, AVATAR_PLACEHOLDER } from './shared.js';
// After:
import { connectWS, scaleWidget, fmt, AVATAR_PLACEHOLDER } from './shared.js';
```
Line 68: `connectSSE(` → `connectWS(`

**`server/overlay/winner.ts`** — line 1:
```typescript
// Before:
import { connectSSE, scaleWidget, fmt, AVATAR_PLACEHOLDER } from './shared.js';
// After:
import { connectWS, scaleWidget, fmt, AVATAR_PLACEHOLDER } from './shared.js';
```
Line 24: `connectSSE(` → `connectWS(`

- [ ] **Step 3: Typecheck**

```bash
bun run --cwd server typecheck
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add server/overlay/shared.ts \
        server/overlay/index.ts \
        server/overlay/lot.ts \
        server/overlay/price.ts \
        server/overlay/timer.ts \
        server/overlay/bids.ts \
        server/overlay/top-bid.ts \
        server/overlay/winner.ts
git commit -m "feat: replace connectSSE with connectWS across all overlay widgets"
```

---

## Task 4: Create the connection widget

**Files:**
- Create: `server/overlay/connection.html`
- Create: `server/overlay/connection.css`
- Create: `server/overlay/connection.ts`

- [ ] **Step 1: Create `server/overlay/connection.html`**

```html
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Подключение</title>
  <link rel="stylesheet" href="/overlay/shared.css" />
  <link rel="stylesheet" href="/overlay/connection.css" />
</head>
<body>
  <div id="widget">
    <span id="dot"></span>
    <span id="label">Подключение…</span>
  </div>
  <script type="module" src="/overlay/connection.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `server/overlay/connection.css`**

```css
#widget {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  width: 220px;
  height: 50px;
  background: rgba(20, 20, 20, 0.85);
  border-radius: 10px;
  font-family: "Inter", system-ui, -apple-system, sans-serif;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}

#dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  background: #6b7280;
  transition: background 0.3s;
}

#widget.connected #dot {
  background: #22c55e;
}

#widget.disconnected #dot {
  background: #ef4444;
  animation: blink 1s ease-in-out infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.2; }
}
```

- [ ] **Step 3: Create `server/overlay/connection.ts`**

```typescript
import { onConnectionChange, connectWS } from './shared.js';

const widget  = document.getElementById('widget')!;
const labelEl = document.getElementById('label')!;

onConnectionChange((connected) => {
  widget.classList.toggle('connected',    connected);
  widget.classList.toggle('disconnected', !connected);
  labelEl.textContent = connected ? 'Подключено' : 'Нет связи';
});

// Start the WS connection — no auction state needed, only connection events.
connectWS(() => {});
```

- [ ] **Step 4: Typecheck**

```bash
bun run --cwd server typecheck
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add server/overlay/connection.html \
        server/overlay/connection.css \
        server/overlay/connection.ts
git commit -m "feat: add connection overlay widget (WebSocket status indicator)"
```

---

## Task 5: Register `/overlay/connection` route + update bundle-assets

**Files:**
- Modify: `server/src/routes/overlay.ts`
- Modify: `server/scripts/bundle-assets.ts`

- [ ] **Step 1: Add connection route in `server/src/routes/overlay.ts`**

Add one GET route before the wildcard, after the existing `/overlay/` route:

```typescript
    .get('/overlay/connection', () => serveOverlay('connection.html'))
```

The full `.get` block in the file should now look like:
```typescript
    .get('/overlay', () => serveOverlay('index.html'))
    .get('/overlay/', () => serveOverlay('index.html'))
    .get('/overlay/connection', () => serveOverlay('connection.html'))
    .get('/overlay/*', ({ request }) => {
```

- [ ] **Step 2: Update `server/scripts/bundle-assets.ts`** — add `"connection"` to `WIDGETS`

```typescript
// Before:
const WIDGETS = ['lot', 'price', 'timer', 'bids', 'top-bid', 'winner'];
// After:
const WIDGETS = ['lot', 'price', 'timer', 'bids', 'top-bid', 'winner', 'connection'];
```

This single change automatically adds `connection.html`, `connection.css`, and `connection.js` to the three bundle loops (`HTML_NAMES`, `CSS_NAMES`, `TS_NAMES` all derive from `WIDGETS`).

- [ ] **Step 3: Typecheck**

```bash
bun run --cwd server typecheck
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/overlay.ts server/scripts/bundle-assets.ts
git commit -m "feat: register /overlay/connection route and include in bundle"
```

---

## Task 6: Add ConnectionWidget to widgets.tsx

**Files:**
- Modify: `server/overlay/widgets.tsx`

- [ ] **Step 1: Add `ConnectionWidget` component**

After the `WinnerWidget` function (around line 205) and before the `WIDGET_DIMENSIONS` export, add:

```tsx
// ─── Connection widget — 220 × 50 ────────────────────────────────────────────

export function ConnectionWidget() {
  return (
    <div style={{ ...FONT, width: 220, height: 50, background: 'rgba(20,20,20,0.85)',
                  borderRadius: 10, display: 'flex', alignItems: 'center',
                  gap: 10, padding: '0 16px' }}>
      <span style={{ width: 10, height: 10, borderRadius: '50%',
                     background: '#22c55e', flexShrink: 0 }} />
      <span style={{ fontSize: 14, fontWeight: 600 }}>Подключено</span>
    </div>
  );
}
```

- [ ] **Step 2: Add `connection` to `WIDGET_DIMENSIONS`**

In the `WIDGET_DIMENSIONS` object (currently ends at `winner`), add:

```typescript
export const WIDGET_DIMENSIONS = {
  overlay:  { w: 1920, h: 500 },
  lot:      { w: 420,  h: 420 },
  price:    { w: 460,  h: 180 },
  timer:    { w: 380,  h: 110 },
  bids:     { w: 560,  h: 600, extraPadBottom: 16 },
  'top-bid':{ w: 460,  h: 220 },
  winner:   { w: 560,  h: 130 },
  connection: { w: 220, h: 50  },
} as const;
```

`WidgetId = keyof typeof WIDGET_DIMENSIONS` now automatically includes `"connection"`.

- [ ] **Step 3: Typecheck (server)**

```bash
bun run --cwd server typecheck
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add server/overlay/widgets.tsx
git commit -m "feat: add ConnectionWidget component and WIDGET_DIMENSIONS entry"
```

---

## Task 7: Update Overlays.tsx

Adding the connection widget to the UI and suppressing the `show_after_finished` toggle for it.

**Files:**
- Modify: `src/pages/Overlays.tsx`

- [ ] **Step 1: Add `ConnectionWidget` to imports**

In the import from `'../../server/overlay/widgets'`, add `ConnectionWidget`:

```typescript
import {
  LotWidget,
  PriceWidget,
  TimerWidget,
  BidsWidget,
  TopBidWidget,
  WinnerWidget,
  FullWidget,
  ConnectionWidget,
  WIDGET_DIMENSIONS,
  type WidgetId,
} from '../../server/overlay/widgets';
```

- [ ] **Step 2: Add connection widget to `WIDGETS` array**

At the end of the `WIDGETS` array (after `winner`):

```typescript
  { id: 'connection' as WidgetId, name: 'Подключение', description: 'Статус соединения', url: `${BASE}/overlay/connection` },
```

- [ ] **Step 3: Add `connection` to `WIDGET_COMPONENTS`**

```typescript
const WIDGET_COMPONENTS: Record<WidgetId, React.ReactNode> = {
  overlay:    <FullWidget />,
  lot:        <LotWidget />,
  price:      <PriceWidget />,
  timer:      <TimerWidget />,
  bids:       <BidsWidget />,
  'top-bid':  <TopBidWidget />,
  winner:     <WinnerWidget />,
  connection: <ConnectionWidget />,
};
```

- [ ] **Step 4: Add `showToggle` prop to `WidgetCard`**

The connection widget does not depend on auction state, so the `show_after_finished` toggle is meaningless for it. Add a `showToggle` prop to `WidgetCard` (default `true`) and conditionally render the toggle block.

Change the `WidgetCardProps` interface:

```typescript
interface WidgetCardProps {
  widget: typeof WIDGETS[number];
  showAfterFinished: boolean;
  onToggleShowAfter: (checked: boolean) => void;
  showToggle?: boolean;
}
```

Update the function signature:

```typescript
function WidgetCard({ widget, showAfterFinished, onToggleShowAfter, showToggle = true }: WidgetCardProps) {
```

Wrap the toggle block (lines 112–127) in a condition:

```tsx
      {/* Show-after-finished toggle */}
      {showToggle && (
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
      )}
```

- [ ] **Step 5: Pass `showToggle={false}` for the connection widget**

In the `WIDGETS.map(...)` render in the page, update to:

```tsx
        {WIDGETS.map((w) => (
          <WidgetCard
            key={w.id}
            widget={w}
            showAfterFinished={showAfterIds.includes(w.id)}
            onToggleShowAfter={(checked) => toggle(w.id, checked)}
            showToggle={w.id !== 'connection'}
          />
        ))}
```

- [ ] **Step 6: Typecheck (frontend)**

```bash
bun run typecheck
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/pages/Overlays.tsx
git commit -m "feat: add connection widget to Overlays page"
```

---

## Task 8: Cleanup — delete sse.ts and full typecheck

**Files:**
- Delete: `server/src/overlay/sse.ts`

- [ ] **Step 1: Delete `server/src/overlay/sse.ts`**

```bash
rm server/src/overlay/sse.ts
```

- [ ] **Step 2: Full typecheck (both server and frontend)**

```bash
bun run --cwd server typecheck && bun run typecheck
```

Expected: no errors on either side

- [ ] **Step 3: Commit**

```bash
git add -u server/src/overlay/sse.ts
git commit -m "chore: remove SSEBroadcaster (replaced by WSBroadcaster)"
```
