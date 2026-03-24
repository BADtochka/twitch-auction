import { connectWS, scaleWidget, fmt, AVATAR_PLACEHOLDER } from './shared.js';
import type { AuctionState } from './shared.js';

const widget    = document.getElementById('widget')!;
const avatarEl  = document.getElementById('winner-avatar') as HTMLImageElement;
const nameEl    = document.getElementById('winner-username')!;
const amountEl  = document.getElementById('winner-amount')!;

scaleWidget(widget, 560, 130);

let currencyLabel = '';

function show(username: string, amount: number, avatarUrl?: string) {
  widget.classList.remove('hidden');
  nameEl.textContent   = username;
  amountEl.textContent = currencyLabel ? `${fmt(amount)} ${currencyLabel}` : fmt(amount);
  const src = (avatarUrl) || AVATAR_PLACEHOLDER;
  avatarEl.src = src;
  avatarEl.onerror = () => { avatarEl.onerror = null; avatarEl.src = AVATAR_PLACEHOLDER; };
}

let keepAfterFinished = false;

connectWS(
  (state: AuctionState) => {
    currencyLabel      = state.config.currency_label;
    keepAfterFinished  = state.config.widgets_show_after_finished?.includes('winner') ?? false;
    if (state.status !== 'finished' || !keepAfterFinished) { widget.classList.add('hidden'); return; }
    const w = state.bids.find(b => b.status === 'winner');
    if (!w) { widget.classList.add('hidden'); return; }
    show(w.username, w.amount, w.avatar_url);
  },
  undefined,
  (winner) => {
    if (!winner?.username || !keepAfterFinished) { widget.classList.add('hidden'); return; }
    show(winner.username, winner.amount ?? 0);
  }
);
