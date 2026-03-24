import { Elysia } from 'elysia';
import { SSEBroadcaster } from '../overlay/sse';
import { serveOverlay } from '../overlay/assets';
import { log } from '../logger';

export function createOverlayRoutes(broadcaster: SSEBroadcaster) {
  return new Elysia()
    // Static routes first — Elysia's radix router prioritises these over wildcard,
    // but explicit ordering makes the intent clear.
    .get('/overlay/events', () => {
      log('info', 'SSE client connected');
      return broadcaster.connect();
    })
    .get('/overlay', () => serveOverlay('index.html'))
    .get('/overlay/', () => serveOverlay('index.html'))
    // Wildcard: extract filename from pathname to avoid param-typing issues.
    .get('/overlay/*', ({ request }) => {
      const filename = decodeURIComponent(
        new URL(request.url).pathname.slice('/overlay/'.length)
      );
      log('info', `overlay asset: ${filename}`);
      return serveOverlay(filename);
    });
}
