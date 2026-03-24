import { Elysia } from 'elysia';
import { handleAuth } from '../twitch/auth';
import { renderAuthError } from '../views/auth';
import { readSettings } from '../settings';
import { log } from '../logger';

const HTML = 'text/html; charset=utf-8';

export const authRoutes = new Elysia()
  .get('/auth/status', async () => {
    const settings = await readSettings();
    const authed = !!settings.tokens?.access_token;
    return { authed, channel_login: settings.twitch?.channel_login ?? null };
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
      set.status = res.status;
      return res.text();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log('error', `auth callback: ${msg}`);
      set.status = 500;
      return renderAuthError(`Внутренняя ошибка: ${msg}`);
    }
  });
