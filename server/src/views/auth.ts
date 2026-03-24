import { renderPage } from './layout';
import { icons } from './icons';

export function renderAuthSuccess(login: string): string {
  const body = `
    <div class="icon">${icons.circleCheck(48, '#00d166')}</div>
    <h1>Авторизация успешна</h1>
    <div class="subtitle" style="color: #a970ff;">
      <span class="dot" style="background: #00d166;"></span>
      ${login}
    </div>
    <p>Можете закрыть эту вкладку и вернуться в приложение.</p>`;

  return renderPage('Twitch Auction — Авторизация', body);
}

export function renderAuthError(message: string): string {
  const body = `
    <div class="icon">${icons.circleX(48, '#ff6b6b')}</div>
    <h1>Ошибка авторизации</h1>
    <div class="subtitle" style="color: #ff6b6b;">
      <span class="dot" style="background: #ff6b6b;"></span>
      Не удалось войти
    </div>
    <p>${message}</p>`;

  return renderPage('Twitch Auction — Ошибка', body);
}
