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
