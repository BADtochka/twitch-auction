import { readSettings, writeSettings } from '../settings';
import { renderAuthSuccess, renderAuthError } from '../views/auth';

const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const HTML = { 'Content-Type': 'text/html; charset=utf-8' };

function htmlError(message: string, status: number): Response {
  return new Response(renderAuthError(message), { status, headers: HTML });
}

export async function handleAuth(code: string): Promise<Response> {
  const settings = await readSettings();
  const clientId     = settings.twitch?.client_id;
  const clientSecret = settings.twitch?.client_secret;

  if (!clientId || !clientSecret) {
    return htmlError('Приложение не настроено: отсутствует client_id или client_secret.', 500);
  }

  const port = settings.overlay?.port ?? 3000;
  const tokenBody = new URLSearchParams({
    client_id:    clientId,
    client_secret: clientSecret,
    code,
    grant_type:   'authorization_code',
    redirect_uri: `http://localhost:${port}/auth/callback`,
  });

  const tokenRes = await fetch(TWITCH_TOKEN_URL, { method: 'POST', body: tokenBody });
  if (!tokenRes.ok) {
    return htmlError(`Не удалось обменять код на токен: ${await tokenRes.text()}`, 502);
  }

  const tokens = await tokenRes.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  const userRes = await fetch('https://api.twitch.tv/helix/users', {
    headers: {
      'Authorization': `Bearer ${tokens.access_token}`,
      'Client-Id': clientId,
    },
  });

  if (!userRes.ok) {
    return htmlError(`Не удалось получить данные пользователя: ${await userRes.text()}`, 502);
  }

  const { data: [user] } = await userRes.json() as { data: Array<{ id: string; login: string }> };

  await writeSettings({
    ...settings,
    twitch: { ...settings.twitch!, channel_login: user.login, channel_id: user.id },
    tokens: {
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token,
      obtained_at:   Date.now(),
      expires_in:    tokens.expires_in,
    },
  });

  return new Response(renderAuthSuccess(user.login), { headers: HTML });
}
