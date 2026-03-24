import { connectWS, scaleWidget } from './shared.js';
import type { AuctionState } from './shared.js';

const widget  = document.getElementById('widget')!;
const imageEl = document.getElementById('lot-image') as HTMLImageElement;
const titleEl = document.getElementById('lot-title')!;
let currentPath = '';

scaleWidget(widget, 420, 420);

function setImage(path: string, scale: number) {
  if (path === currentPath) return;
  currentPath = path;
  imageEl.classList.remove('loaded');
  if (!path) { imageEl.removeAttribute('src'); return; }
  imageEl.src = path;
  imageEl.onload  = () => imageEl.classList.add('loaded');
  imageEl.onerror = () => imageEl.classList.remove('loaded');
}

let keepAfterFinished = false;

connectWS(
  (state: AuctionState) => {
    keepAfterFinished = state.config.widgets_show_after_finished?.includes('lot') ?? false;
    if (state.status === 'idle' || (state.status === 'finished' && !keepAfterFinished)) { widget.classList.add('hidden'); return; }
    widget.classList.remove('hidden');
    setImage(state.config.lot_image_path, state.config.lot_image_scale ?? 1);
    titleEl.textContent = state.config.show_lot_title !== false ? state.config.lot_title : '';
  },
  undefined,
  () => { if (!keepAfterFinished) widget.classList.add('hidden'); }
);
