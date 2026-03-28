import { invoke } from "@tauri-apps/api/core";
import { Check, Copy, ExternalLink, RotateCcw, Trophy } from "lucide-react";
import { useState } from "react";
import { env } from "../env";
import { useAuctionStore } from "../store/auctionStore";

const SERVER_PORT = env.VITE_SERVER_PORT;
const WINNER_URL = `http://localhost:${SERVER_PORT}/overlay/winner`;

export default function Results() {
  const auction = useAuctionStore((s) => s.auction);
  const setAuction = useAuctionStore((s) => s.setAuction);
  const [copied, setCopied] = useState(false);

  const winner = auction?.bids.find(
    (b) => b.status === "winner" || b.id === auction.winner_id
  );
  const approved = [...(auction?.bids ?? [])]
    .filter((b) => b.status === "approved" || b.status === "winner")
    .sort((a, b) => b.amount - a.amount);

  const reset = () => {
    setAuction({ ...auction!, status: "idle", bids: [], winner_id: undefined });
  };

  const copyUrl = async () => {
    await navigator.clipboard.writeText(WINNER_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 flex flex-col gap-6 items-center justify-center min-h-screen">
      <h1 className="flex items-center gap-3 text-3xl font-bold">
        <Trophy size={28} className="text-yellow-400" />
        Аукцион завершён
      </h1>

      {winner ? (
        <div className="w-full max-w-md flex flex-col gap-3">
          {/* Winner card */}
          <div className="rounded-2xl border-2 border-amber-500/70 bg-zinc-900 px-5 py-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Trophy size={20} className="text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-500 mb-0.5">Победитель</p>
              <p className="text-xl font-bold text-white truncate">{winner.username}</p>
            </div>
            <span className="bg-amber-500 text-zinc-900 rounded-lg px-4 py-1.5 text-lg font-black tabular-nums shrink-0">
              {winner.amount.toLocaleString("ru-RU")} {auction?.config.currency_label}
            </span>
          </div>

          {/* Winner overlay widget link */}
          <div className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2">
            <span className="text-[11px] text-zinc-500 font-mono truncate mr-2">{WINNER_URL}</span>
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                onClick={() => invoke("open_url", { url: WINNER_URL })}
                className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 px-2 py-1 rounded hover:bg-zinc-700 transition-colors"
              >
                <ExternalLink size={11} />
                Открыть
              </button>
              <button
                onClick={copyUrl}
                className="text-zinc-500 hover:text-zinc-300 p-1 rounded hover:bg-zinc-700 transition-colors"
                title="Копировать ссылку"
              >
                {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-zinc-400">Нет одобренных ставок</p>
      )}

      {approved.length > 0 && (
        <div className="w-full max-w-md">
          <h3 className="text-sm text-zinc-400 mb-2">Итоговый список</h3>
          <ul className="flex flex-col gap-1">
            {approved.map((bid, i) => (
              <li
                key={bid.id}
                className="flex justify-between px-3 py-2 rounded bg-zinc-800"
              >
                <span>
                  <span className="text-zinc-500 mr-2">#{i + 1}</span>
                  {bid.username}
                </span>
                <span className="font-bold tabular-nums">
                  {bid.amount.toLocaleString("ru-RU")} {auction?.config.currency_label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={reset}
        className="flex items-center gap-2 px-6 py-2 rounded bg-purple-600 hover:bg-purple-500 font-semibold"
      >
        <RotateCcw size={15} />
        Новый аукцион
      </button>
    </div>
  );
}
