import { onConnectionChange, connectWS } from './shared.js';

const widget  = document.getElementById('widget')!;
const labelEl = document.getElementById('label')!;

onConnectionChange((connected) => {
  widget.classList.toggle('connected',    connected);
  widget.classList.toggle('disconnected', !connected);
  labelEl.textContent = connected ? 'Подключено' : 'Нет связи';
});

// Start the WS connection — no auction state needed, only connection events.
connectWS(() => {});
