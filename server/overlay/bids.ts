import { connectWS, scaleWidget, fmt, AVATAR_PLACEHOLDER } from './shared.js';
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

function stableAt(container: HTMLElement, idx: number): HTMLElement | null {
  let count = 0;
  for (const child of Array.from(container.children) as HTMLElement[]) {
    if (!child.classList.contains('removing')) {
      if (count === idx) return child;
      count++;
    }
  }
  return null;
}

function renderBids(state: AuctionState) {
  const approved = state.bids
    .filter(b => b.status === 'approved' || b.status === 'winner')
    .sort((a, b) => b.amount - a.amount)
    .slice(0, state.config.top_bids_in_overlay);

  // All cards in DOM, including ones being removed
  const allCards = new Map<string, HTMLElement>();
  for (const child of Array.from(listEl.children) as HTMLElement[]) {
    if (child.dataset.bidId) allCards.set(child.dataset.bidId, child);
  }

  const incoming = new Set(approved.map(b => b.id));

  // Reconcile removal state: remove departing, cancel removal for returning
  for (const [id, el] of allCards) {
    if (!incoming.has(id)) {
      if (!el.classList.contains('removing')) {
        el.classList.add('removing');
        el.addEventListener('animationend', () => el.remove(), { once: true });
      }
    } else if (el.classList.contains('removing')) {
      // Bid returned — cancel exit animation
      el.classList.remove('removing');
      el.style.animation = 'none';
    } else {
      el.style.animation = 'none';
    }
  }

  // Position stable cards (stableAt skips .removing elements)
  for (let i = 0; i < approved.length; i++) {
    const bid   = approved[i];
    const atPos = stableAt(listEl, i);
    const el    = allCards.get(bid.id);
    if (el) {
      if (atPos !== el) listEl.insertBefore(el, atPos ?? null);
    } else {
      listEl.insertBefore(createCard(bid), atPos ?? null);
    }
  }
}

let keepAfterFinished = false;

connectWS(
  (state: AuctionState) => {
    keepAfterFinished = state.config.widgets_show_after_finished?.includes('bids') ?? false;
    if (state.status === 'idle' || (state.status === 'finished' && !keepAfterFinished)) { widget.classList.add('hidden'); return; }
    widget.classList.remove('hidden');
    renderBids(state);
  },
  undefined,
  () => { if (!keepAfterFinished) widget.classList.add('hidden'); }
);
