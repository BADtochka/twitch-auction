import { Pause, Play } from "lucide-react";
import { useTimer } from "../../hooks/useTimer";
import { useAuction } from "../../hooks/useAuction";
import { useAuctionStore } from "../../store/auctionStore";

function fmt(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function Timer() {
  const timerLeft = useTimer();
  const status = useAuctionStore((s) => s.auction?.status);
  const { pauseAuction } = useAuction();

  return (
    <div className="flex items-center gap-3">
      <span className="text-3xl font-bold tabular-nums text-purple-400">{fmt(timerLeft)}</span>
      <button
        onClick={() => pauseAuction()}
        className="flex items-center gap-1.5 px-3 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-sm"
      >
        {status === "running"
          ? <><Pause size={13} /> Пауза</>
          : <><Play size={13} /> Продолжить</>
        }
      </button>
    </div>
  );
}
