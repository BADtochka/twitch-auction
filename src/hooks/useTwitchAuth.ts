import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";

const CLIENT_ID = import.meta.env.VITE_TWITCH_CLIENT_ID ?? "";
const SERVER_PORT = import.meta.env.VITE_SERVER_PORT ?? "3000";
const REDIRECT_URI = `http://localhost:${SERVER_PORT}/auth/callback`;
const AUTH_STATUS_URL = `http://localhost:${SERVER_PORT}/auth/status`;
const SCOPES = [
  "channel:read:redemptions",
  "channel:manage:redemptions",
  "chat:read",
  "user:read:chat",
  "moderator:read:chat_messages",
].join(" ");

export function useTwitchAuth() {
  const [authed, setAuthed] = useState(false);
  const [channelLogin, setChannelLogin] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkStatus = async (): Promise<boolean> => {
    try {
      const res = await fetch(AUTH_STATUS_URL, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data = await res.json() as { authed: boolean; channel_login: string | null };
        setAuthed(data.authed);
        setChannelLogin(data.channel_login);
        return data.authed;
      }
    } catch {}
    return false;
  };

  useEffect(() => {
    checkStatus();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const login = async () => {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: SCOPES,
    });
    await invoke("open_url", { url: `https://id.twitch.tv/oauth2/authorize?${params}` });

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

  return { authed, channelLogin, login };
}
