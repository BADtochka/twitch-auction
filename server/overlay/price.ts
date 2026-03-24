import { connectSSE, scaleWidget, fmt } from './shared.js';
import type { AuctionState } from './shared.js';

const widget    = document.getElementById('widget')!;
const amountEl  = document.getElementById('price-amount')!;
const unitEl    = document.getElementById('price-unit')!;

scaleWidget(widget, 460, 180);

let keepAfterFinished = false;

connectSSE(
  (state: AuctionState) => {
    keepAfterFinished = state.config.widgets_show_after_finished?.includes('price') ?? false;
    if (state.status === 'idle' || (state.status === 'finished' && !keepAfterFinished)) { widget.classList.add('hidden'); return; }
    widget.classList.remove('hidden');
    amountEl.textContent = fmt(state.config.starting_price);
    unitEl.textContent   = state.config.currency_label;
  },
  undefined,
  () => { if (!keepAfterFinished) widget.classList.add('hidden'); }
);
