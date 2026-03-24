import { connectSSE, scaleWidget, fmtTime } from './shared.js';
import type { AuctionState } from './shared.js';

const widget  = document.getElementById('widget')!;
const textEl  = document.getElementById('timer-text')!;
let currentState: AuctionState | null = null;

scaleWidget(widget, 380, 110);

function renderTimer(secs: number, status: string) {
  textEl.textContent = fmtTime(secs);
  textEl.className =
    status === 'paused' ? 'paused' :
    secs <= 30 && secs > 0 ? 'warning' : '';
}

let keepAfterFinished = false;

connectSSE(
  (state: AuctionState) => {
    currentState = state;
    keepAfterFinished = state.config.widgets_show_after_finished?.includes('timer') ?? false;
    if (state.status === 'idle' || (state.status === 'finished' && !keepAfterFinished)) { widget.classList.add('hidden'); return; }
    widget.classList.remove('hidden');
    renderTimer(state.timer_left_seconds, state.status);
  },
  (secs, status) => {
    if (!currentState) return;
    currentState.timer_left_seconds = secs;
    renderTimer(secs, status);
  },
  () => { if (!keepAfterFinished) widget.classList.add('hidden'); }
);
