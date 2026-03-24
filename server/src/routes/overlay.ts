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
