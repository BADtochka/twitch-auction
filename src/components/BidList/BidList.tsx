import { useState } from "react";
import { AlertTriangle, Check, CheckCircle, RotateCcw, Trophy, X, XCircle, Clock } from "lucide-react";
import { useAuctionStore, type Bid } from "../../store/auctionStore";
import { useAuction } from "../../hooks/useAuction";

type Filter = "all" | "pending" | "approved";

export default function BidList() {
  const bids = useAuctionStore((s) => s.auction?.bids ?? []);
  const config = useAuctionStore((s) => s.auction?.config);
  const { approveBid, rejectBid } = useAuction();
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = [...bids]
    .filter((b) => filter === "all" || b.status === filter)
    .sort((a, b) => b.amount - a.amount);

  const leader = bids
    .filter((b) => b.status === "approved")
    .sort((a, b) => b.amount - a.amount)[0];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(["all", "pending", "approved"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded text-sm ${
                filter === f ? "bg-purple-600" : "bg-zinc-700 hover:bg-zinc-600"
              }`}
            >
              {f === "all" ? "Все" : f === "pending" ? "Ожидают" : "Одобрены"}
            </button>
          ))}
        </div>
      </div>

      <ul className="flex flex-col gap-1">
        {filtered.map((bid) => (
          <BidRow
            key={bid.id}
            bid={bid}
            currencyLabel={config?.currency_label ?? ""}
            onApprove={() => approveBid(bid.id)}
            onReject={() => rejectBid(bid.id)}
          />
        ))}
        {filtered.length === 0 && (
          <li className="text-zinc-500 text-sm text-center py-4">Ставок нет</li>
        )}
      </ul>

      {leader && (
        <div className="mt-2 text-sm text-zinc-400">
          Лидер:{" "}
          <span className="text-white font-semibold">{leader.username}</span> —{" "}
          {leader.amount.toLocaleString("ru-RU")} {config?.currency_label}
        </div>
      )}
    </div>
  );
}

function StatusIcon({ bid }: { bid: Bid }) {
  if (bid.status === "approved") return <CheckCircle size={14} className="text-green-400 shrink-0" />;
  if (bid.status === "rejected") return <XCircle size={14} className="text-red-400 shrink-0" />;
  if (bid.status === "winner")   return <Trophy size={14} className="text-yellow-400 shrink-0" />;
  return <Clock size={14} className="text-yellow-400 shrink-0" />;
}

function BidRow({
  bid,
  currencyLabel,
  onApprove,
  onReject,
}: {
  bid: Bid;
  currencyLabel: string;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <li className="flex items-center gap-3 px-3 py-2 rounded bg-zinc-800 hover:bg-zinc-750">
      {bid.is_flagged && (
        <span title="Нереалистичная ставка">
          <AlertTriangle size={14} className="text-yellow-400 shrink-0" />
        </span>
      )}
      <StatusIcon bid={bid} />
      <span className="flex-1 font-medium">{bid.username}</span>
      <span className="font-bold tabular-nums">
        {bid.amount.toLocaleString("ru-RU")} {currencyLabel}
      </span>
      {bid.status !== "winner" && (
        <div className="flex gap-1">
          {(bid.status === "pending" || bid.status === "rejected") && (
            <button
              onClick={onApprove}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                bid.status === "rejected"
                  ? "bg-zinc-600 hover:bg-zinc-500"
                  : "bg-green-700 hover:bg-green-600"
              }`}
            >
              {bid.status === "rejected"
                ? <><RotateCcw size={11} /> Вернуть</>
                : <><Check size={11} /> Одобрить</>}
            </button>
          )}
          {(bid.status === "pending" || bid.status === "approved") && (
            <button
              onClick={onReject}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-red-800 hover:bg-red-700"
            >
              <X size={11} /> Откл
            </button>
          )}
        </div>
      )}
    </li>
  );
}
