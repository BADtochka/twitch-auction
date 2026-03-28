import { ChevronDown, ImagePlus, Play, RefreshCw, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAuction } from "../../hooks/useAuction";
import { useRewards } from "../../hooks/useRewards";
import { useAuctionStore, type AuctionConfig } from "../../store/auctionStore";

const defaults: AuctionConfig = {
  lot_title: "",
  show_lot_title: true,
  lot_image_path: "",
  lot_image_scale: 1,
  starting_price: 0,
  currency: "channel_points",
  currency_label: "₽",
  duration_seconds: 600,
  min_bid_step: 100,
  unrealistic_multiplier: 10,
  snipe_protection_seconds: 30,
  chat_command: "!bid",
  disable_chat_when_reward: false,
  top_bids_in_overlay: 5,
  widgets_show_after_finished: [],
};

const STORAGE_KEY = "auction-setup-config";

function loadConfig(): AuctionConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {}
  return defaults;
}

const INPUT = [
  "w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2",
  "text-sm text-white placeholder:text-zinc-600",
  "focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20",
  "transition-colors",
].join(" ");

// ─── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-zinc-800/50 border border-zinc-700/40 rounded-xl p-4 flex flex-col gap-3">
      <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">{title}</span>
      {children}
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5 flex-1">
      <span className="text-xs font-medium text-zinc-400">{label}</span>
      {children}
      {hint && <span className="text-[10px] text-zinc-500">{hint}</span>}
    </label>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-3">{children}</div>;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div
      role="switch"
      aria-checked={checked}
      tabIndex={0}
      onClick={() => onChange(!checked)}
      onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onChange(!checked); } }}
      className="flex items-center gap-2 cursor-pointer select-none group"
    >
      <div className={`w-7 h-4 rounded-full flex items-center px-0.5 transition-colors flex-shrink-0 ${checked ? "bg-purple-600" : "bg-zinc-700 group-hover:bg-zinc-600"}`}>
        <div className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-3" : "translate-x-0"}`} />
      </div>
      <span className="text-[11px] text-zinc-500 group-hover:text-zinc-400 transition-colors leading-none">{label}</span>
    </div>
  );
}

function CustomSelect({ value, onChange, children }: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        className={INPUT + " appearance-none pr-8 cursor-pointer"}
      >
        {children}
      </select>
      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

interface Props {
  authed: boolean;
}

export default function AuctionSetup({ authed }: Props) {
  const { startAuction } = useAuction();
  const setAuction = useAuctionStore((s) => s.setAuction);
  const [config, setConfig] = useState<AuctionConfig>(loadConfig);
  const { rewards, loading: rewardsLoading, available: channelPointsAvailable, refresh: refreshRewards } = useRewards(authed);
  const [error, setError] = useState("");

  const set = <K extends keyof AuctionConfig>(key: K, value: AuctionConfig[K]) =>
    setConfig((c) => {
      const next = { ...c, [key]: value };
      // lot_image_path is a base64 data URI — too large for localStorage
      const { lot_image_path: _, ...saveable } = next;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saveable));
      return next;
    });

  const reset = () => {
    localStorage.removeItem(STORAGE_KEY);
    setConfig(defaults);
  };

  const pickImage = async () => {
    const result = await invoke<string | null>("pick_image");
    if (result) set("lot_image_path", result);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!config.lot_title.trim()) return setError("Введите название лота");
    try {
      const data = await startAuction(config);
      setAuction(data);
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">

      {/* ── Лот ────────────────────────────────────────────────────────── */}
      <Section title="Лот">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Название</span>
            <Toggle
              checked={config.show_lot_title}
              onChange={(v) => set("show_lot_title", v)}
              label="показывать в оверлее"
            />
          </div>
          <input
            value={config.lot_title}
            onChange={(e) => set("lot_title", e.target.value)}
            className={INPUT}
            placeholder="Введите название лота"
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-zinc-400">Изображение</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={pickImage}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-sm text-zinc-300 hover:text-white transition-colors"
            >
              <ImagePlus size={14} />
              Выбрать файл
            </button>
            {config.lot_image_path && (
              <button
                type="button"
                onClick={() => set("lot_image_path", "")}
                className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-700/50 transition-colors"
                title="Удалить"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {config.lot_image_path && (
            <div className="flex items-center gap-4 pt-1">
              <div
                className="rounded-lg border border-zinc-700 overflow-hidden shrink-0 bg-zinc-950"
                style={{ width: Math.round(72 * config.lot_image_scale), height: Math.round(72 * config.lot_image_scale), maxWidth: 180, maxHeight: 180 }}
              >
                <img src={config.lot_image_path} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <span className="text-[11px] text-zinc-500">Размер — {config.lot_image_scale.toFixed(1)}×</span>
                <input
                  type="range"
                  min={0.5} max={3} step={0.1}
                  value={config.lot_image_scale}
                  onChange={(e) => set("lot_image_scale", Number(e.target.value))}
                  className="w-full accent-purple-500"
                />
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* ── Ставки ─────────────────────────────────────────────────────── */}
      <Section title="Ставки">
        <Row>
          <Field label="Стартовая цена">
            <input
              type="number"
              value={config.starting_price}
              onChange={(e) => set("starting_price", Number(e.target.value))}
              className={INPUT}
              min={0}
            />
          </Field>
          <Field label="Валюта">
            <input
              value={config.currency_label}
              onChange={(e) => set("currency_label", e.target.value)}
              className={INPUT}
              placeholder="баллов"
            />
          </Field>
        </Row>
        <Row>
          <Field label="Мин. шаг ставки">
            <input
              type="number"
              value={config.min_bid_step}
              onChange={(e) => set("min_bid_step", Number(e.target.value))}
              className={INPUT}
              min={0}
            />
          </Field>
          <Field label="Макс. ставка (авто-флаг)" hint="Оставьте пустым чтобы не ограничивать">
            <input
              type="number"
              value={config.max_bid_threshold ?? ""}
              onChange={(e) => set("max_bid_threshold", e.target.value ? Number(e.target.value) : undefined)}
              className={INPUT}
              placeholder="не задано"
            />
          </Field>
        </Row>
        <Field label="Множитель нереалистичной ставки" hint="Ставка > лучшей × множитель → авто-флаг">
          <input
            type="number"
            value={config.unrealistic_multiplier}
            onChange={(e) => set("unrealistic_multiplier", Number(e.target.value))}
            className={INPUT}
            min={1} step={0.5}
          />
        </Field>
      </Section>

      {/* ── Channel Points ─────────────────────────────────────────────── */}
      {authed && (
        <Section title="Channel Points">
          {!channelPointsAvailable ? (
            <p className="text-xs text-zinc-500">
              Баллы канала недоступны — доступно только для партнёров и аффилиатов Twitch.
            </p>
          ) : (
            <>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-400">Награда за баллы</span>
                <button
                  type="button"
                  onClick={refreshRewards}
                  disabled={rewardsLoading}
                  className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50 transition-colors disabled:opacity-40"
                  title="Обновить список наград"
                >
                  <RefreshCw size={12} className={rewardsLoading ? "animate-spin" : ""} />
                </button>
              </div>
              {rewardsLoading ? (
                <div className="text-xs text-zinc-500 px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900">
                  Загрузка наград...
                </div>
              ) : (
                <CustomSelect
                  value={config.reward_id ?? ""}
                  onChange={(e) => set("reward_id", e.target.value || undefined)}
                >
                  <option value="">— любая награда —</option>
                  {rewards.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title} ({r.cost.toLocaleString("ru-RU")})
                      {r.is_paused ? " [пауза]" : ""}
                      {!r.is_enabled ? " [выкл]" : ""}
                    </option>
                  ))}
                </CustomSelect>
              )}
              <span className="text-[10px] text-zinc-500">
                Только эта награда принимается как ставка. Сумма берётся из сообщения к награде.
              </span>
            </div>
            {config.reward_id && (
              <Toggle
                checked={config.disable_chat_when_reward}
                onChange={(v) => set("disable_chat_when_reward", v)}
                label="отключить чат-команду пока активна эта награда"
              />
            )}
            </>
          )}
        </Section>
      )}

      {/* ── Настройки ──────────────────────────────────────────────────── */}
      <Section title="Настройки">
        <Row>
          <Field label="Длительность (сек)">
            <input
              type="number"
              value={config.duration_seconds}
              onChange={(e) => set("duration_seconds", Number(e.target.value))}
              className={INPUT}
              min={10}
            />
          </Field>
          <Field label="Защита от снайпинга (сек)" hint="Продление таймера при ставке в конце">
            <input
              type="number"
              value={config.snipe_protection_seconds}
              onChange={(e) => set("snipe_protection_seconds", Number(e.target.value))}
              className={INPUT}
              min={0}
            />
          </Field>
        </Row>
        <Row>
          <Field label="Чат-команда">
            <input
              value={config.chat_command}
              onChange={(e) => set("chat_command", e.target.value)}
              className={INPUT}
            />
          </Field>
          <Field label="Ставок в оверлее">
            <input
              type="number"
              value={config.top_bids_in_overlay}
              onChange={(e) => set("top_bids_in_overlay", Number(e.target.value))}
              className={INPUT}
              min={1} max={20}
            />
          </Field>
        </Row>
      </Section>

      {error && (
        <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* ── Actions ────────────────────────────────────────────────────── */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 text-sm font-medium transition-colors"
        >
          <RotateCcw size={14} />
          Сброс
        </button>
        <button
          type="submit"
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm transition-colors"
        >
          <Play size={15} />
          Начать аукцион
        </button>
      </div>
    </form>
  );
}
