import { connectWS, scaleWidget, createCountUpAnimator, AVATAR_PLACEHOLDER } from './shared.js';
import type { AuctionState } from './shared.js';

const widget   = document.getElementById('widget')!;
const amountEl = document.getElementById('amount')!;
const unitEl   = document.getElementById('unit')!;
const avatarEl = document.getElementById('avatar') as HTMLImageElement;
const nameEl   = document.getElementById('username')!;

scaleWidget(widget, 460, 160);

const animateAmount = createCountUpAnimator(amountEl, 600);

function render(state: AuctionState) {
  const keep = state.config.widgets_show_after_finished?.includes('top-bid') ?? false;
  if (state.status === 'idle' || (state.status === 'finished' && !keep)) { widget.classList.add('hidden'); return; }

  const top = state.bids
    .filter(b => b.status === 'approved' || b.status === 'winner')
    .sort((a, b) => b.amount - a.amount)[0];

  if (!top) { widget.classList.add('hidden'); return; }
  widget.classList.remove('hidden');

  animateAmount(top.amount);
  unitEl.textContent = state.config.currency_label;

  if (top.avatar_url && top.source !== 'manual') {
    avatarEl.src = top.avatar_url;
    avatarEl.onerror = () => { avatarEl.onerror = null; avatarEl.src = AVATAR_PLACEHOLDER; };
  } else {
    avatarEl.src = AVATAR_PLACEHOLDER;
  }
  nameEl.textContent = top.username;
}

let keepAfterFinished = false;

connectWS(
  (state: AuctionState) => {
    keepAfterFinished = state.config.widgets_show_after_finished?.includes('top-bid') ?? false;
    render(state);
  },
  undefined,
  () => { if (!keepAfterFinished) widget.classList.add('hidden'); }
);
