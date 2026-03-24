import { useEffect, useRef } from "react";
import { useAuctionStore } from "../store/auctionStore";

export function useTimer() {
  const status    = useAuctionStore((s) => s.auction?.status);
  const timerLeft = useAuctionStore((s) => s.auction?.timer_left_seconds ?? 0);
  const setTimerLeft = useAuctionStore((s) => s.setTimerLeft);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (status === "running") {
      intervalRef.current = setInterval(() => {
        setTimerLeft(Math.max(0, (useAuctionStore.getState().auction?.timer_left_seconds ?? 0) - 1));
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [status]);

  return timerLeft;
}
