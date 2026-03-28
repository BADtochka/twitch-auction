import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';
import credentials from './credentials.json';

export const env = createEnv({
  server: {
    TWITCH_CLIENT_ID: z.string().default(credentials.client_id),
    TWITCH_CLIENT_SECRET: z.string().default(credentials.client_secret),
    PORT: z.coerce.number().default(3000),
    OVERLAY_THEME: z.string().default('default'),
    OVERLAY_SHOW_TIMER: z.string().default('true').transform(v => v !== 'false'),
    OVERLAY_TOP_BIDS_COUNT: z.coerce.number().default(5),
    OVERLAY_ANIMATION: z.string().default('slide'),
    AUCTION_DURATION_SECONDS: z.coerce.number().default(300),
    AUCTION_MIN_BID_STEP: z.coerce.number().default(100),
    AUCTION_UNREALISTIC_MULTIPLIER: z.coerce.number().default(3),
    AUCTION_SNIPE_PROTECTION_SECONDS: z.coerce.number().default(30),
    AUCTION_CHAT_COMMAND: z.string().default('!bid'),
    AUCTION_AUTO_APPROVE: z.string().default('false').transform(v => v === 'true'),
    AUCTION_AUTO_APPROVE_THRESHOLD: z.coerce.number().default(1000),
  },
  runtimeEnv: process.env,
});
