# WebSocket Overlay Transport + Connection Widget

**Date:** 2026-03-24
**Status:** Approved

## Overview

Replace the SSE transport used by browser overlay widgets with WebSocket for more stable connections and explicit reconnection control. Add a new `connection` overlay widget that displays real-time connection status (green/red indicator), addable as an optional OBS source.

## Architecture

### Current state
- `server/src/overlay/sse.ts` — `SSEBroadcaster` pushes named SSE events to browser overlays
- `server/src/routes/overlay.ts` — `GET /overlay/events` HTTP endpoint
- `server/overlay/shared.ts` — `connectSSE()` used by all 7 widgets

### Target state
- `server/src/overlay/ws.ts` — `WSBroadcaster` replaces `SSEBroadcaster`
- `server/src/routes/overlay.ts` — `.ws('/overlay/events', {...})` Elysia WebSocket route
- `server/overlay/shared.ts` — `connectWS()` replaces `connectSSE()`
- `server/overlay/connection.*` — new 8th widget

## Components

### 1. WSBroadcaster (`server/src/overlay/ws.ts`)

Replaces `SSEBroadcaster`. Responsibilities:
- Maintains `Set<ElysiaWS>` of active connections. Elysia 1.4 `.ws()` handlers receive `ElysiaWS` instances (not raw `ServerWebSocket`); `WSBroadcaster` stores these directly and calls `ws.send(json)` on each.
- `broadcast(type: string, data: unknown)` — serialises `{ type, data }` as JSON and sends to all clients; removes dead sockets on send error. **Also updates `lastState` cache when `type === "auction_state"`** (same as SSEBroadcaster did in `send()`).
- Caches last `auction_state` in `lastState`; sends it immediately to new clients in the `open` handler
- `setInitialState(state)` — pre-loads cache from persisted auction state on startup (same as before)

Message envelope format (server → client):
```json
{ "type": "auction_state" | "bid_approved" | "bid_rejected" | "timer_tick" | "auction_finished", "data": { ... } }
```

### 2. Overlay WebSocket route (`server/src/routes/overlay.ts`)

`.ws('/overlay/events', { open(ws), message(ws), close(ws) })` replaces `GET /overlay/events`.

- `open`: registers socket with `WSBroadcaster` and sends cached `auction_state` if present; logs `'WS client connected'`
- `close`: removes socket from `WSBroadcaster`
- `message`: no-op — overlay clients are read-only

**Note on routing:** Elysia `.ws()` registers a WebSocket upgrade handler. A WS upgrade request to `/overlay/events` is handled exclusively by this handler; it does not fall through to the wildcard `GET /overlay/*` route. No conflict.

The `createOverlayRoutes` function parameter type changes from `SSEBroadcaster` to `WSBroadcaster` — update both the function signature in `routes/overlay.ts` and the call site in `index.ts`.

Static overlay file routes (`/overlay`, `/overlay/*`) remain unchanged.

### 3. connectWS (`server/overlay/shared.ts`)

Replaces `connectSSE()`. Same callback signature:
```ts
connectWS(
  onState: StateHandler,
  onTick?: TickHandler,
  onFinished?: FinishedHandler
): { close(): void }
```

Returns `{ close() }` instead of `EventSource`. The `close()` method is a future affordance for explicit teardown; none of the current 7 widget files use the return value (they call `connectWS(...)` as a statement), so this is a non-breaking change.

**Internal state:** `connectWS` maintains a `currentStatus` closure variable (same as `connectSSE`) — updated by `auction_state` and `auction_finished` handlers, and passed to `onTick`. Required because `timer_tick` data from the server only carries `seconds_left`; the status must come from the last known state.

**Message dispatch in `onmessage`:** parse `{ type, data }` from `event.data`. Handle:
- `auction_state` → call `onState`
- `timer_tick` → call `onTick`
- `auction_finished` → call `onFinished`
- `bid_approved`, `bid_rejected` → **intentionally ignored** — widgets rely on full `auction_state` snapshots rather than incremental events

**Reconnection logic:**
- On `close` or `onerror`: schedule reconnect with exponential backoff (1s → 2s → 4s → … → 30s max)
- On successful `open`: reset backoff delay to 1s
- Each reconnect creates a fresh `WebSocket` instance

**Connection state broadcast:**
```ts
type ConnectionListener = (connected: boolean) => void;
export function onConnectionChange(cb: ConnectionListener): () => void
```
- Listeners are stored in a **module-level** `Set` — they persist across reconnects
- Called with `true` on each successful `open`, `false` on each `close` or `onerror`
- Returns an unsubscribe function that removes the listener from the set

All 7 existing overlay files change one symbol: `connectSSE` → `connectWS`. No other changes.

### 4. Connection widget (`server/overlay/connection.*`)

Three new files: `connection.html`, `connection.ts`, `connection.css`.

**Visual design:** a small pill (~220×50px) suitable for an OBS corner source.
- Connected: `● Подключено` — green dot, white text
- Disconnected: `● Нет связи` — red blinking dot, white text

`connection.ts` imports `onConnectionChange` from `'./shared.js'` (same `.js` extension convention used by all other overlay `.ts` files) — no auction state logic.

**Route:** `/overlay/connection` — added alongside existing widget routes.

### 5. Bundle assets (`server/scripts/bundle-assets.ts`)

The `WIDGETS` array drives all three loops (`HTML_NAMES`, `CSS_NAMES`, `TS_NAMES`):
```ts
const WIDGETS = ['lot', 'price', 'timer', 'bids', 'top-bid', 'winner', 'connection'];
```
Adding `"connection"` here covers `connection.html`, `connection.css`, and `connection.ts` (bundled as `connection.js`) in one change.

### 6. Overlay widgets preview (`server/overlay/widgets.tsx`)

Add `"connection"` to `WIDGET_DIMENSIONS`:
```ts
connection: { w: 220, h: 50 }
```

Add a `ConnectionWidget` React component (inline static mock for the preview — no live data):
```tsx
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

`WidgetId` is derived from `WIDGET_DIMENSIONS` via `keyof typeof WIDGET_DIMENSIONS`, so adding the entry automatically extends the type.

### 7. Frontend Overlays page (`src/pages/Overlays.tsx`)

Three targeted changes required:

**A — Add to `WIDGETS` array:**
```ts
{ id: 'connection' as WidgetId, name: 'Подключение', description: 'Статус соединения', url: `${BASE}/overlay/connection` }
```

**B — Add to `WIDGET_COMPONENTS`:**
```ts
connection: <ConnectionWidget />
```
(import `ConnectionWidget` from `widgets.tsx`)

**C — Suppress `show_after_finished` toggle for the connection widget:**
The `WidgetCard` always renders the toggle. Pass a `showToggle` prop (default `true`); set it to `false` for the connection widget. Alternatively, render a `null` spacer to preserve layout. The connection widget is independent of auction state — the toggle is meaningless for it.

## Data Flow

```
Rust stdin → handleRustMessage() → WSBroadcaster.broadcast(type, data)
                                         │
                    WebSocket ws://127.0.0.1:3000/overlay/events
                                         │
                         overlay widget connectWS()
                               ├── onState()    ← auction_state
                               ├── onTick()     ← timer_tick
                               └── onFinished() ← auction_finished
                         onConnectionChange()
                               └── connection widget (open/close/error)
```

## Error Handling

- Dead sockets caught on `broadcast()` send error — socket removed from Set immediately
- Client-side: `WebSocket.onerror` triggers reconnect; backoff caps at 30s
- Module-level `onConnectionChange` listeners survive reconnects and correctly reflect each connect/disconnect cycle

## Files Changed

| File | Change |
|------|--------|
| `server/src/overlay/sse.ts` | Delete |
| `server/src/overlay/ws.ts` | Create (`WSBroadcaster`) |
| `server/src/routes/overlay.ts` | Replace SSE GET route with `.ws()` route |
| `server/src/index.ts` | `SSEBroadcaster` → `WSBroadcaster` |
| `server/overlay/shared.ts` | Replace `connectSSE` with `connectWS` + `onConnectionChange` |
| `server/overlay/connection.html` | Create |
| `server/overlay/connection.ts` | Create |
| `server/overlay/connection.css` | Create |
| `server/overlay/widgets.tsx` | Add `connection` to `WIDGET_DIMENSIONS` + `ConnectionWidget` component |
| `server/scripts/bundle-assets.ts` | Add `"connection"` to `WIDGETS` array |
| `src/pages/Overlays.tsx` | Add connection widget entry, component, suppress toggle |
| `server/overlay/*.ts` (7 files) | `connectSSE` → `connectWS` (one symbol per file) |
