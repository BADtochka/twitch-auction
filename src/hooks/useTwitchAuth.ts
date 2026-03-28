import { invoke } from '@tauri-apps/api/core';
import { useEffect, useRef, useState } from 'react';

import { env } from '../env';

const SERVER_PORT = env.VITE_SERVER_PORT;
const REDIRECT_URI = `http://localhost:${SERVER_PORT}/auth/callback`;
const AUTH_STATUS_URL = `http://localhost:${SERVER_PORT}/auth/status`;
const SCOPES = [
  'channel:read:redemptions',
  'channel:manage:redemptions',
  'chat:read',
  'user:read:chat',
  'user:write:chat',
  'moderator:read:chat_messages',
].join(' ');

export function useTwitchAuth() {
  const [authed, setAuthed] = useState(false);
  const [channelLogin, setChannelLogin] = useState<string | null>(null);
  const [scopeWarning, setScopeWarning] = useState(false);
  const [clientId, setClientId] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkStatus = async (): Promise<boolean> => {
    try {
      const res = await fetch(AUTH_STATUS_URL, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data = (await res.json()) as { authed: boolean; channel_login: string | null; scope_warning?: boolean; client_id?: string };
        setAuthed(data.authed);
        setChannelLogin(data.channel_login);
        setScopeWarning(data.scope_warning ?? false);
        setClientId(data.client_id ?? '');
        return data.authed;
      }
    } catch {}
    return false;
  };

  useEffect(() => {
    checkStatus();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const login = async () => {
    if (!clientId) return;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: SCOPES,
    });
    await invoke('open_url', { url: `https://id.twitch.tv/oauth2/authorize?${params}` });

    // Poll until auth completes (max ~2 min)
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      const done = await checkStatus();
      if (done || attempts >= 60) {
        clearInterval(pollRef.current!);
        pollRef.current = null;
      }
    }, 2000);
  };

  return { authed, channelLogin, scopeWarning, login };
}
