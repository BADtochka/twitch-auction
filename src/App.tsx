import { useEffect, useState } from "react";
import { Bug } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useAuctionStore, type AuctionData, type Bid } from "./store/auctionStore";
import { useServerStatus } from "./hooks/useServerStatus";
import Setup from "./pages/Setup";
import Live from "./pages/Live";
import Results from "./pages/Results";
import Debug from "./pages/Debug";
import Overlays from "./pages/Overlays";

const STATUS_CONFIG = {
  connected:    { dot: "bg-green-500",  label: "Сервер подключён" },
  disconnected: { dot: "bg-red-500",    label: "Нет подключения"  },
  checking:     { dot: "bg-zinc-500 animate-pulse", label: "Проверка..."  },
} as const;

export default function App() {
  const status = useAuctionStore((s) => s.auction?.status ?? "idle");
  const { status: serverStatus } = useServerStatus();
  const [showDebug, setShowDebug] = useState(false);
  const [showOverlays, setShowOverlays] = useState(false);
  const store = useAuctionStore();

  useEffect(() => {
    invoke<AuctionData>("get_auction_state").then(store.setAuction).catch(console.error);

    const unlisteners = [
      listen<{ auction_id: string; bid: Bid }>("bid:new", (e) => {
        if (useAuctionStore.getState().auction?.id === e.payload.auction_id) {
          store.addBid(e.payload.bid);
        }
      }),
      listen<Bid>("bid:updated", (e) => store.updateBid(e.payload)),
      listen<{ seconds_left: number }>("timer:tick", (e) =>
        store.setTimerLeft(e.payload.seconds_left)
      ),
      listen<AuctionData>("auction:started", (e) => store.setAuction(e.payload)),
      listen<{ status: string }>("auction:status", (e) =>
        store.setStatus(e.payload.status as AuctionData["status"])
      ),
      listen<Bid | null>("auction:finished", (e) => {
        store.setStatus("finished");
        if (e.payload) store.updateBid(e.payload);
      }),
    ];

    return () => {
      unlisteners.forEach((p) => p.then((fn) => fn()));
    };
  }, []);

  let Page: React.ReactNode;
  if (showOverlays) {
    Page = <Overlays onBack={() => setShowOverlays(false)} />;
  } else if (showDebug) {
    Page = <Debug />;
  } else if (status === "finished") {
    Page = <Results />;
  } else if (status === "running" || status === "paused") {
    Page = <Live onShowOverlays={() => setShowOverlays(true)} />;
  } else {
    Page = <Setup onShowOverlays={() => setShowOverlays(true)} />;
  }

  const srv = STATUS_CONFIG[serverStatus];

  return (
    <div className="relative h-screen">
      <div className="h-full overflow-auto">{Page}</div>

      {/* Bottom-right overlay */}
      <div
        onClick={() => setShowDebug((v) => !v)}
        className="fixed bottom-3 right-3 flex items-center gap-2 z-50 select-none cursor-pointer bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1.5 rounded-lg transition-colors"
        title="Debug"
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${srv.dot}`} />
        <span className="text-xs text-zinc-400">{srv.label}</span>
        <Bug size={13} className={showDebug ? "text-zinc-100" : "text-zinc-500"} />
      </div>
    </div>
  );
}
