import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  clientPrefix: 'VITE_',
  client: {
    VITE_SERVER_PORT: z.coerce.number().default(3000),
    VITE_TWITCH_CLIENT_ID: z.string().default(''),
  },
  runtimeEnv: import.meta.env,
});
