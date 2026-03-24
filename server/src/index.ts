import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { WSBroadcaster } from './overlay/ws';
import { readSettings, readAuctionState } from './settings';
import { startTwitchGateway, setChatCommand, refundAndNotify, notifyTooLow } from './twitch/gateway';
import { log } from './logger';
import { healthRoutes } from './routes/health';
import { authRoutes } from './routes/auth-callback';
import { rewardsRoutes } from './routes/rewards';
import { createOverlayRoutes } from './routes/overlay';

const broadcaster = new WSBroadcaster();

const settings = await readSettings();
const PORT = settings.overlay?.port ?? 3000;

const savedAuctionState = await readAuctionState();
if (savedAuctionState) {
  broadcaster.setInitialState(savedAuctionState);
}

const app = new Elysia()
  .use(cors())
  .use(healthRoutes)
  .use(authRoutes)
  .use(rewardsRoutes)
  .use(createOverlayRoutes(broadcaster))
  .listen(PORT);

log('info', `Server listening on http://127.0.0.1:${PORT}`);
console.error(`[server] listening on http://127.0.0.1:${PORT}`);

startTwitchGateway()
  .then((listener) => {
    log('info', 'Twitch gateway started');
    if (listener) {
      const shutdown = async () => {
        console.error('[gateway] Shutting down EventSub listener...');
        await listener.stop();
        process.exit(0);
      };
      process.on('SIGTERM', shutdown);
      process.on('SIGINT',  shutdown);
    }
  })
  .catch((err) => log('error', `Gateway failed: ${err instanceof Error ? err.message : err}`));

readStdin();

async function readStdin() {
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of Bun.stdin.stream() as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop()!; // keep the potentially incomplete last line
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        handleRustMessage(JSON.parse(line));
      } catch {
        // ignore malformed JSON
      }
    }
  }
}

function handleRustMessage(msg: unknown) {
  if (!msg || typeof msg !== 'object') return;
  const m = msg as Record<string, unknown>;
  switch (m.type) {
    case 'overlay:state': {
      broadcaster.broadcast('auction_state', m.data);
      const cfg = (m.data as Record<string, unknown> | null)?.config as Record<string, unknown> | undefined;
      if (typeof cfg?.chat_command === 'string') setChatCommand(cfg.chat_command);
      break;
    }
    case 'bid:approved':     broadcaster.broadcast('bid_approved',   m.data); break;
    case 'bid:rejected':     broadcaster.broadcast('bid_rejected',   m.data); break;
    case 'timer:tick':       broadcaster.broadcast('timer_tick',     m.data); break;
    case 'auction:finished': broadcaster.broadcast('auction_finished', m.data); break;
    case 'bid:too_low': {
      const d = m as Record<string, unknown>;
      const username    = d.username    as string;
      const minRequired = d.min_required as number;
      const redemptionId = d.redemption_id as string | undefined;
      const rewardId     = d.reward_id    as string | undefined;
      if (redemptionId && rewardId) {
        refundAndNotify(redemptionId, rewardId, username, minRequired).catch(() => {});
      } else {
        notifyTooLow(username, minRequired).catch(() => {});
      }
      break;
    }
  }
}

export type { app };
