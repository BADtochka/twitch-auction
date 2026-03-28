import { Elysia } from 'elysia';
import { log } from '../logger';
import { readSettings } from '../settings';
import { handleAuth } from '../twitch/auth';
import { renderAuthError } from '../views/auth';

const HTML = 'text/html; charset=utf-8';

const REQUIRED_SCOPES = [
  'channel:read:redemptions',
  'channel:manage:redemptions',
  'chat:read',
  'user:read:chat',
  'user:write:chat',
  'moderator:read:chat_messages',
];

// Cache per server session — reset on restart, updated after each OAuth callback
let scopeCache: { missing: string[] } | null = null;

export function clearScopeCache() {
  scopeCache = null;
}

async function checkTokenScopes(token: string): Promise<string[]> {
  if (scopeCache) return scopeCache.missing;
  try {
    const res = await fetch('https://id.twitch.tv/oauth2/validate', {
      headers: { Authorization: `OAuth ${token}` },
    });
    if (!res.ok) {
      scopeCache = { missing: ['invalid_token'] };
      return scopeCache.missing;
    }
    const data = (await res.json()) as { scopes: string[] };
    const missing = REQUIRED_SCOPES.filter((s) => !data.scopes.includes(s));
    scopeCache = { missing };
    if (missing.length > 0) {
      log('warn', `[auth] Token missing scopes: ${missing.join(', ')}`);
    }
    return missing;
  } catch {
    return [];
  }
}

export const authRoutes = new Elysia()
  .get('/auth/status', async () => {
    const settings = await readSettings();
    const token = settings.tokens?.access_token;
    const client_id = settings.twitch?.client_id ?? '';
    if (!token) return { authed: false, channel_login: null, scope_warning: false, client_id };
    const missing = await checkTokenScopes(token);
    return {
      authed: true,
      channel_login: settings.twitch?.channel_login ?? null,
      scope_warning: missing.length > 0,
      client_id,
    };
  })
  .get('/auth/callback', async ({ query, set }) => {
    set.headers['content-type'] = HTML;

    const code = (query as Record<string, string>)['code'];
    if (!code) {
      set.status = 400;
      return renderAuthError('Отсутствует параметр code.');
    }

    try {
      const res = await handleAuth(code);
      if (res.ok) clearScopeCache(); // force re-check on next /auth/status
      set.status = res.status;
      return res.text();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log('error', `auth callback: ${msg}`);
      set.status = 500;
      return renderAuthError(`Внутренняя ошибка: ${msg}`);
    }
  });
