import { AlertTriangle, Check, Layout, LogIn } from "lucide-react";
import AuctionSetup from "../components/AuctionSetup/AuctionSetup";
import { useTwitchAuth } from "../hooks/useTwitchAuth";

interface Props {
  onShowOverlays: () => void;
}

export default function Setup({ onShowOverlays }: Props) {
  const { authed, channelLogin, scopeWarning, login } = useTwitchAuth();

  return (
    <div className="min-h-screen flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-lg flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Twitch Auction</h1>
            <p className="text-xs text-zinc-500 mt-0.5">Настройка лота</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onShowOverlays}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-purple-500/50 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 hover:border-purple-400/70 text-sm font-medium transition-colors"
            >
              <Layout size={14} />
              Виджеты
            </button>
            <div className="flex flex-col items-end gap-1">
              <button
                onClick={login}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  authed && !scopeWarning
                    ? "bg-green-500/10 border border-green-500/30 text-green-400"
                    : authed && scopeWarning
                    ? "bg-yellow-500/10 border border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/20"
                    : "bg-purple-600 hover:bg-purple-500 text-white"
                }`}
              >
                {authed && !scopeWarning ? <Check size={14} /> : authed && scopeWarning ? <AlertTriangle size={14} /> : <LogIn size={14} />}
                {authed ? (channelLogin ? `@${channelLogin}` : "Twitch подключён") : "Войти через Twitch"}
              </button>
              {authed && scopeWarning && (
                <p className="text-xs text-yellow-500/90 text-right max-w-[200px]">
                  Требуется повторная авторизация
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Form */}
        <AuctionSetup authed={authed} />

      </div>
    </div>
  );
}
