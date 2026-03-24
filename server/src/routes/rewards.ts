import { Elysia } from 'elysia';
import { readSettings } from '../settings';

interface TwitchReward {
  id: string;
  title: string;
  cost: number;
  background_color: string;
  is_enabled: boolean;
  is_paused: boolean;
}

export const rewardsRoutes = new Elysia()
  .get('/api/rewards', async () => {
    const settings = await readSettings();
    const token     = settings.tokens?.access_token;
    const channelId = settings.twitch?.channel_id;
    const clientId  = settings.twitch?.client_id;

    if (!token || !channelId || !clientId) {
      return { error: 'not_authed' };
    }

    const res = await fetch(
      `https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${channelId}`,
      { headers: { Authorization: `Bearer ${token}`, 'Client-Id': clientId } },
    ).catch(() => null);

    if (!res) return { error: 'api_error' };

    // 403 = channel points not available (e.g. non-affiliate/partner)
    if (res.status === 403 || res.status === 404) {
      return { error: 'channel_points_not_available' };
    }
    if (!res.ok) return { error: 'api_error' };

    const { data } = await res.json() as { data: TwitchReward[] };
    return {
      rewards: data.map((r) => ({
        id:         r.id,
        title:      r.title,
        cost:       r.cost,
        color:      r.background_color,
        is_enabled: r.is_enabled,
        is_paused:  r.is_paused,
      })),
    };
  });
