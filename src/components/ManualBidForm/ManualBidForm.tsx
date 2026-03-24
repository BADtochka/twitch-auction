import { useState } from "react";
import { PlusCircle } from "lucide-react";
import { useAuction } from "../../hooks/useAuction";

export default function ManualBidForm() {
  const { addManualBid } = useAuction();
  const [username, setUsername] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const amt = parseInt(amount, 10);
    if (!username.trim()) return setError("Введите никнейм");
    if (isNaN(amt) || amt <= 0) return setError("Введите корректную сумму");
    try {
      await addManualBid(username.trim(), amt);
      setUsername("");
      setAmount("");
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-end">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-400">Никнейм</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="px-2 py-1 rounded bg-zinc-700 border border-zinc-600 text-sm"
          placeholder="username"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-400">Сумма</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="px-2 py-1 rounded bg-zinc-700 border border-zinc-600 text-sm w-28"
          placeholder="0"
          min={1}
        />
      </div>
      <button
        type="submit"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-sm font-medium"
      >
        <PlusCircle size={14} /> Добавить
      </button>
      {error && <span className="text-red-400 text-xs">{error}</span>}
    </form>
  );
}
