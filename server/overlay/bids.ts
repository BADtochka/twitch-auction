import { connectSSE, scaleWidget, fmt, AVATAR_PLACEHOLDER } from './shared.js';
import type { AuctionState, Bid } from './shared.js';

const widget    = document.getElementById('widget')!;
const listEl    = document.getElementById('bid-list')!;

scaleWidget(widget, 560, 500);

function createCard(bid: Bid): HTMLElement {
  const li = document.createElement('li');
  li.className   = 'bid-card';
  li.dataset.bidId = bid.id;

  const img = document.createElement('img');
  img.className = 'bid-avatar';
  img.alt = '';
  if (bid.avatar_url && bid.source !== 'manual') {
    img.src = bid.avatar_url;
    img.onerror = () => { img.onerror = null; img.src = AVATAR_PLACEHOLDER; };
  } else {
    img.src = AVATAR_PLACEHOLDER;
  }

  const name = document.createElement('span');
  name.className   = 'bid-username';
  name.textContent = bid.username;

  const pill = document.createElement('span');
  pill.className   = 'bid-amount-pill';
  pill.textContent = fmt(bid.amount);

  li.append(img, name, pill);
  return li;
}

function renderBids(state: AuctionState) {
  const approved = state.bids
    .filter(b => b.status === 'approved' || b.status === 'winner')
    .sort((a, b) => b.amount - a.amount)
    .slice(0, state.config.top_bids_in_overlay);

  const existing = new Map<string, HTMLElement>();
  for (const child of Array.from(listEl.children) as HTMLElement[]) {
    if (child.dataset.bidId) existing.set(child.dataset.bidId, child);
  }
  for (const el of existing.values()) el.style.animation = 'none';

  const incoming = new Set(approved.map(b => b.id));
  for (const [id, el] of existing) if (!incoming.has(id)) el.remove();

  for (let i = 0; i < approved.length; i++) {
    const bid   = approved[i];
    const atPos = listEl.children[i] as HTMLElement | undefined;
    if (existing.has(bid.id)) {
      const el = existing.get(bid.id)!;
      if (atPos !== el) listEl.insertBefore(el, atPos ?? null);
    } else {
      listEl.insertBefore(createCard(bid), atPos ?? null);
    }
  }
}

let keepAfterFinished = false;

connectSSE(
  (state: AuctionState) => {
    keepAfterFinished = state.config.widgets_show_after_finished?.includes('bids') ?? false;
    if (state.status === 'idle' || (state.status === 'finished' && !keepAfterFinished)) { widget.classList.add('hidden'); return; }
    widget.classList.remove('hidden');
    renderBids(state);
  },
  undefined,
  () => { if (!keepAfterFinished) widget.classList.add('hidden'); }
);
