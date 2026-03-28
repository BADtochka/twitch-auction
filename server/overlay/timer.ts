import { connectWS, scaleWidget, renderTimer } from './shared.js';
import type { AuctionState } from './shared.js';

const widget = document.getElementById('widget')!;
const textEl = document.getElementById('timer-text')!;
let currentState: AuctionState | null = null;

scaleWidget(widget, 380, 110);

let keepAfterFinished = false;

connectWS(
  (state: AuctionState) => {
    currentState = state;
    keepAfterFinished = state.config.widgets_show_after_finished?.includes('timer') ?? false;
    if (state.status === 'idle' || (state.status === 'finished' && !keepAfterFinished)) { widget.classList.add('hidden'); return; }
    widget.classList.remove('hidden');
    renderTimer(textEl, state.timer_left_seconds, state.status);
  },
  (secs, status) => {
    if (!currentState) return;
    currentState.timer_left_seconds = secs;
    renderTimer(textEl, secs, status);
  },
  () => { if (!keepAfterFinished) widget.classList.add('hidden'); }
);
