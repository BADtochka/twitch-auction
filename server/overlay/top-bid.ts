import { connectWS, scaleWidget, fmt, AVATAR_PLACEHOLDER } from './shared.js';
import type { AuctionState } from './shared.js';

const widget    = document.getElementById('widget')!;
const amountEl  = document.getElementById('amount')!;
const unitEl    = document.getElementById('unit')!;
const avatarEl  = document.getElementById('avatar') as HTMLImageElement;
const nameEl    = document.getElementById('username')!;

scaleWidget(widget, 460, 220);

// ─── Count-up animation ───────────────────────────────────────────────────────

const DURATION = 600; // ms
let currentAmount = 0;
let rafId: number | null = null;

function countUp(from: number, to: number) {
  if (rafId !== null) cancelAnimationFrame(rafId);

  const start = performance.now();

  function tick(now: number) {
    const t = Math.min((now - start) / DURATION, 1);
    // ease-out cubic
    const eased = 1 - Math.pow(1 - t, 3);
    const value = Math.round(from + (to - from) * eased);
    amountEl.textContent = fmt(value);
    if (t < 1) rafId = requestAnimationFrame(tick);
    else { rafId = null; amountEl.textContent = fmt(to); }
  }

  rafId = requestAnimationFrame(tick);
}

// ─── Render ───────────────────────────────────────────────────────────────────

function render(state: AuctionState) {
  const keep = state.config.widgets_show_after_finished?.includes('top-bid') ?? false;
  if (state.status === 'idle' || (state.status === 'finished' && !keep)) { widget.classList.add('hidden'); return; }

  const top = state.bids
    .filter(b => b.status === 'approved' || b.status === 'winner')
    .sort((a, b) => b.amount - a.amount)[0];

  if (!top) { widget.classList.add('hidden'); return; }
  widget.classList.remove('hidden');

  if (top.amount !== currentAmount) {
    countUp(currentAmount, top.amount);
    currentAmount = top.amount;
  }
  unitEl.textContent = state.config.currency_label;

  if (top.avatar_url && top.source !== 'manual') {
    avatarEl.src = top.avatar_url;
    avatarEl.onerror = () => { avatarEl.onerror = null; avatarEl.src = AVATAR_PLACEHOLDER; };
  } else {
    avatarEl.src = AVATAR_PLACEHOLDER;
  }
  nameEl.textContent = top.username;
}

// ─── SSE ──────────────────────────────────────────────────────────────────────

let keepAfterFinished = false;

connectWS(
  (state: AuctionState) => {
    keepAfterFinished = state.config.widgets_show_after_finished?.includes('top-bid') ?? false;
    render(state);
  },
  undefined,
  () => { if (!keepAfterFinished) widget.classList.add('hidden'); }
);
