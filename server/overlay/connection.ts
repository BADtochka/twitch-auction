import { onConnectionChange, connectWS, scaleWidget } from './shared.js';

const widget  = document.getElementById('widget')!;

scaleWidget(widget, 220, 50);
const labelEl = document.getElementById('label')!;

onConnectionChange((connected) => {
  widget.classList.toggle('connected',    connected);
  widget.classList.toggle('disconnected', !connected);
  labelEl.textContent = connected ? 'Подключено' : 'Нет связи';
});

// Start the WS connection — no auction state needed, only connection events.
connectWS(() => {});
