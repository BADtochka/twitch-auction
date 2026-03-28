import { connectWS, scaleWidget, renderBids } from './shared.js';
import type { AuctionState } from './shared.js';

const widget = document.getElementById('widget')!;
const listEl = document.getElementById('bid-list')!;

scaleWidget(widget, 560, 500);

let keepAfterFinished = false;

connectWS(
  (state: AuctionState) => {
    keepAfterFinished = state.config.widgets_show_after_finished?.includes('bids') ?? false;
    if (state.status === 'idle' || (state.status === 'finished' && !keepAfterFinished)) { widget.classList.add('hidden'); return; }
    widget.classList.remove('hidden');
    renderBids(state, listEl);
  },
  undefined,
  () => { if (!keepAfterFinished) widget.classList.add('hidden'); }
);
