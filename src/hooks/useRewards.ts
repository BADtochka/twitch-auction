import { useState, useEffect, useCallback } from 'react';

const SERVER_PORT = import.meta.env.VITE_SERVER_PORT ?? '3000';
const REWARDS_URL = `http://localhost:${SERVER_PORT}/api/rewards`;

export interface Reward {
  id: string;
  title: string;
  cost: number;
  color: string;
  is_enabled: boolean;
  is_paused: boolean;
}

interface RewardsResponse {
  rewards?: Reward[];
  error?: string;
}

export function useRewards(authed: boolean) {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState(true);

  const load = useCallback(() => {
    if (!authed) { setRewards([]); return; }
    setLoading(true);
    fetch(REWARDS_URL)
      .then((r) => r.json() as Promise<RewardsResponse>)
      .then((data) => {
        if (data.error === 'channel_points_not_available') {
          setAvailable(false);
        } else if (data.rewards) {
          setAvailable(true);
          setRewards(data.rewards);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authed]);

  useEffect(() => { load(); }, [load]);

  return { rewards, loading, available, refresh: load };
}
