import { homedir } from 'node:os';
import { join } from 'node:path';
import staticConfig from '../config.json';

// Dynamic state written at runtime (after OAuth)
interface DynamicState {
  channel_login?: string;
  channel_id?: string;
  tokens?: {
    access_token: string;
    refresh_token: string;
    obtained_at: number;
    expires_in: number;
  };
}

function getAppDataDir(): string {
  switch (process.platform) {
    case 'win32':
      return join(Bun.env.APPDATA ?? homedir(), 'twitch-auction');
    case 'darwin':
      return join(homedir(), 'Library', 'Application Support', 'twitch-auction');
    default:
      return join(Bun.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'twitch-auction');
  }
}

function getStatePath(): string {
  return join(getAppDataDir(), 'state.json');
}

async function readState(): Promise<DynamicState> {
  const file = Bun.file(getStatePath());
  if (!(await file.exists())) return {};
  return file.json() as Promise<DynamicState>;
}

async function writeState(state: DynamicState): Promise<void> {
  const dir = getAppDataDir();
  await Bun.write(join(dir, '.keep'), ''); // ensures directory exists
  await Bun.write(getStatePath(), JSON.stringify(state, null, 2));
}

export interface Settings {
  twitch?: {
    client_id: string;
    client_secret: string;
    channel_login: string;
    channel_id: string;
  };
  tokens?: {
    access_token: string;
    refresh_token: string;
    obtained_at: number;
    expires_in: number;
  };
  overlay?: {
    port: number;
    theme: string;
    show_timer: boolean;
    top_bids_count: number;
    animation: string;
  };
  auction_defaults?: {
    duration_seconds: number;
    min_bid_step: number;
    unrealistic_multiplier: number;
    snipe_protection_seconds: number;
    chat_command: string;
    auto_approve: boolean;
    auto_approve_threshold: number;
  };
}

export async function readSettings(): Promise<Settings> {
  const state = await readState();
  return {
    twitch: {
      client_id: staticConfig.twitch.client_id,
      client_secret: staticConfig.twitch.client_secret,
      channel_login: state.channel_login ?? '',
      channel_id: state.channel_id ?? '',
    },
    tokens: state.tokens,
    overlay: staticConfig.overlay,
    auction_defaults: staticConfig.auction_defaults,
  };
}

export async function writeSettings(settings: Settings): Promise<void> {
  await writeState({
    channel_login: settings.twitch?.channel_login,
    channel_id: settings.twitch?.channel_id,
    tokens: settings.tokens,
  });
}

function getAuctionStatePath(): string {
  return join(getAppDataDir(), 'auction-state.json');
}

export async function readAuctionState(): Promise<unknown | null> {
  try {
    const file = Bun.file(getAuctionStatePath());
    if (await file.exists()) {
      return await file.json();
    }
  } catch {}
  return null;
}
