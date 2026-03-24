import { connectWS, fmt, fmtTime, AVATAR_PLACEHOLDER } from './shared.js';
import type { AuctionState, Bid } from './shared.js';

// ── Scale scene to fill viewport ─────────────────────────────
const DESIGN_W = 1920, DESIGN_H = 500;
const sceneEl  = document.getElementById('scene')!;

function scaleScene() {
  const scale = Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H);
  sceneEl.style.transform = `scale(${scale})`;
}
scaleScene();
window.addEventListener('resize', scaleScene);

// ── Elements ──────────────────────────────────────────────────
const lotImageEl       = document.getElementById('lot-image') as HTMLImageElement;
const lotTitleEl       = document.getElementById('lot-title')!;
const priceAmt         = document.getElementById('price-amount')!;
const priceUnit        = document.getElementById('price-unit')!;
const timerText        = document.getElementById('timer-text')!;
const bidListEl        = document.getElementById('bid-list')!;
const winnerBannerEl   = document.getElementById('winner-banner')!;
const winnerAvatarEl   = document.getElementById('winner-banner-avatar') as HTMLImageElement;
const winnerNameEl     = document.getElementById('winner-banner-username')!;
const winnerAmountEl   = document.getElementById('winner-banner-amount')!;
const topBidCardEl     = document.getElementById('top-bid-card')!;
const topBidAmountEl   = document.getElementById('top-bid-amount')!;
const topBidUnitEl     = document.getElementById('top-bid-unit')!;
const topBidAvatarEl   = document.getElementById('top-bid-avatar') as HTMLImageElement;
const topBidNameEl     = document.getElementById('top-bid-username')!;

let currentPath   = '';
let currentState: AuctionState | null = null;

// ── Lot image ─────────────────────────────────────────────────
function setLotImage(path: string) {
  if (path === currentPath) return;
  currentPath = path;
  lotImageEl.classList.remove('loaded');
  if (!path) { lotImageEl.removeAttribute('src'); return; }
  lotImageEl.src    = path;
  lotImageEl.onload  = () => lotImageEl.classList.add('loaded');
  lotImageEl.onerror = () => lotImageEl.classList.remove('loaded');
}

// ── Timer ─────────────────────────────────────────────────────
function renderTimer(secs: number, status: string) {
  timerText.textContent = fmtTime(secs);
  timerText.className   =
    status === 'paused' ? 'paused' :
    secs <= 30 && secs > 0 ? 'warning' : '';
}

// ── Inline top-bid ────────────────────────────────────────────
const TOP_BID_DURATION = 500;
let topBidCurrent = 0;
let topBidRafId: number | null = null;

function animateTopBid(to: number) {
  const from = topBidCurrent;
  topBidCurrent = to;
  if (topBidRafId !== null) cancelAnimationFrame(topBidRafId);
  if (!from || from === to) { topBidAmountEl.textContent = fmt(to); return; }
  const start = performance.now();
  function tick(now: number) {
    const t = Math.min((now - start) / TOP_BID_DURATION, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    topBidAmountEl.textContent = fmt(Math.round(from + (to - from) * eased));
    if (t < 1) topBidRafId = requestAnimationFrame(tick);
    else { topBidRafId = null; topBidAmountEl.textContent = fmt(to); }
  }
  topBidRafId = requestAnimationFrame(tick);
}

function renderTopBid(state: AuctionState) {
  const top = state.bids
    .filter(b => b.status === 'approved' || b.status === 'winner')
    .sort((a, b) => b.amount - a.amount)[0];

  if (!top) { topBidCardEl.classList.add('hidden'); return; }
  topBidCardEl.classList.remove('hidden');
  animateTopBid(top.amount);
  topBidUnitEl.textContent = state.config.currency_label;
  if (top.avatar_url && top.source !== 'manual') {
    topBidAvatarEl.src = top.avatar_url;
    topBidAvatarEl.onerror = () => { topBidAvatarEl.onerror = null; topBidAvatarEl.src = AVATAR_PLACEHOLDER; };
  } else {
    topBidAvatarEl.src = AVATAR_PLACEHOLDER;
  }
  topBidNameEl.textContent = top.username;
}

// ── Bids ──────────────────────────────────────────────────────
function createCard(bid: Bid): HTMLElement {
  const li = document.createElement('li');
  li.className     = 'bid-card';
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
  for (const child of Array.from(bidListEl.children) as HTMLElement[]) {
    if (child.dataset.bidId) existing.set(child.dataset.bidId, child);
  }
  for (const el of existing.values()) el.style.animation = 'none';

  const incoming = new Set(approved.map(b => b.id));
  for (const [id, el] of existing) if (!incoming.has(id)) el.remove();

  for (let i = 0; i < approved.length; i++) {
    const bid   = approved[i];
    const atPos = bidListEl.children[i] as HTMLElement | undefined;
    if (existing.has(bid.id)) {
      const el = existing.get(bid.id)!;
      if (atPos !== el) bidListEl.insertBefore(el, atPos ?? null);
    } else {
      bidListEl.insertBefore(createCard(bid), atPos ?? null);
    }
  }
}

// ── Winner banner ─────────────────────────────────────────────
function showWinner(winner: Bid, currencyLabel: string) {
  bidListEl.classList.add('hidden');
  winnerBannerEl.classList.remove('hidden');
  winnerNameEl.textContent   = winner.username;
  winnerAmountEl.textContent = currencyLabel ? `${fmt(winner.amount)} ${currencyLabel}` : fmt(winner.amount);
  const src = (winner.avatar_url && winner.source !== 'manual') ? winner.avatar_url : AVATAR_PLACEHOLDER;
  winnerAvatarEl.src = src;
  winnerAvatarEl.onerror = () => { winnerAvatarEl.onerror = null; winnerAvatarEl.src = AVATAR_PLACEHOLDER; };
}

let keepAfterFinished = false;

// ── Full render ───────────────────────────────────────────────
function renderState(state: AuctionState) {
  currentState      = state;
  keepAfterFinished = state.config.widgets_show_after_finished?.includes('overlay') ?? false;
  if (state.status === 'idle') { sceneEl.classList.add('hidden'); return; }
  sceneEl.classList.remove('hidden');

  setLotImage(state.config.lot_image_path);
  lotTitleEl.textContent = state.config.show_lot_title !== false ? state.config.lot_title : '';
  priceAmt.textContent   = fmt(state.config.starting_price);
  priceUnit.textContent  = state.config.currency_label;

  if (state.status === 'finished') {
    if (!keepAfterFinished) { sceneEl.classList.add('hidden'); return; }
    const winner = state.bids.find(b => b.status === 'winner');
    if (winner) {
      showWinner(winner, state.config.currency_label);
    } else {
      bidListEl.classList.add('hidden');
      winnerBannerEl.classList.add('hidden');
    }
    return;
  }

  bidListEl.classList.remove('hidden');
  winnerBannerEl.classList.add('hidden');
  renderTimer(state.timer_left_seconds, state.status);
  renderBids(state);
  renderTopBid(state);
}

connectWS(
  renderState,
  (secs, status) => {
    if (!currentState) return;
    currentState.timer_left_seconds = secs;
    renderTimer(secs, status);
  },
  (winner) => {
    if (!keepAfterFinished) { sceneEl.classList.add('hidden'); return; }
    if (!winner?.username || !currentState) { sceneEl.classList.add('hidden'); return; }
    sceneEl.classList.remove('hidden');
    bidListEl.classList.add('hidden');
    winnerBannerEl.classList.remove('hidden');
    const currency = currentState.config.currency_label;
    winnerNameEl.textContent   = winner.username;
    winnerAmountEl.textContent = currency ? `${fmt(winner.amount ?? 0)} ${currency}` : fmt(winner.amount ?? 0);
    winnerAvatarEl.src = AVATAR_PLACEHOLDER;
  }
);
