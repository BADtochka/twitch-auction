export class SSEBroadcaster {
  private controllers = new Set<ReadableStreamDefaultController>();
  private encoder = new TextEncoder();
  private lastState: unknown = null;

  setInitialState(state: unknown) {
    this.lastState = state;
  }

  connect(): Response {
    const cachedState = this.lastState;
    let controller!: ReadableStreamDefaultController;
    const stream = new ReadableStream({
      start: (c) => {
        controller = c;
        this.controllers.add(c);
        c.enqueue(this.encoder.encode(": connected\n\n"));
        if (cachedState !== null) {
          c.enqueue(this.encoder.encode(
            `event: auction_state\ndata: ${JSON.stringify(cachedState)}\n\n`
          ));
        }
      },
      cancel: () => {
        this.controllers.delete(controller);
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*",
        Connection: "keep-alive",
      },
    });
  }

  send(event: string, data: unknown) {
    if (event === "auction_state") {
      this.lastState = data;
    }
    const payload = this.encoder.encode(
      `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    );
    for (const ctrl of this.controllers) {
      try {
        ctrl.enqueue(payload);
      } catch {
        this.controllers.delete(ctrl);
      }
    }
  }
}
