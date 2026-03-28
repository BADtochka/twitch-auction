import { dotenvLoad } from 'dotenv-mono';
import { join } from 'node:path';

dotenvLoad();

const clientId = process.env.TWITCH_CLIENT_ID ?? '';
const clientSecret = process.env.TWITCH_CLIENT_SECRET ?? '';

const outPath = join(import.meta.dir, '..', 'src', 'credentials.json');
await Bun.write(outPath, JSON.stringify({ client_id: clientId, client_secret: clientSecret }, null, 2) + '\n');

console.log(`[build-config] credentials.json written (client_id: ${clientId ? clientId.slice(0, 4) + '***' : '(empty)'})`);
