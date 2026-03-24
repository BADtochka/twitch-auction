# ТЗ: Twitch Auction Overlay

> Десктопное приложение для проведения аукционов во время стрима.  
> Стек: **Tauri 2** · **React 19** · **Tailwind CSS 4** · **Bun**

---

## 1. Концепция

Стример выставляет лот (изображение + стартовая цена), запускает таймер — зрители делают ставки через канальные баллы (Channel Points) или команду в чате. Стример видит список ставок в реальном времени, может одобрять/отклонять нереалистичные, а браузерный оверлей на стриме обновляется автоматически.

---

## 2. Архитектура

```
┌──────────────────────────────────────────────────────────┐
│  Tauri App (десктоп)                                     │
│                                                          │
│  ┌─────────────────────┐   ┌──────────────────────────┐ │
│  │  React UI (WebView) │   │  Bun HTTP/WS Server      │ │
│  │  - Панель управления│◄──┤  :3141                   │ │
│  │  - Список ставок    │   │  - /overlay  (SSE/WS)    │ │
│  │  - Настройки лота   │   │  - /api/bids             │ │
│  └─────────────────────┘   │  - /api/auction          │ │
│           │                └──────────┬───────────────┘ │
│           │ Tauri Commands            │                  │
│           ▼                           ▼                  │
│  ┌─────────────────────┐   ┌──────────────────────────┐ │
│  │  Rust Core          │   │  Twitch Gateway (Bun)    │ │
│  │  - State store      │   │  - EventSub WebSocket    │ │
│  │  - Tauri commands   │   │  - channel_points_redeem │ │
│  │  - File system      │   │  - chat message parser   │ │
│  └─────────────────────┘   └──────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
         │ SSE/WebSocket
         ▼
┌─────────────────────────┐
│  Browser Overlay        │
│  (OBS BrowserSource)    │
│  http://localhost:3141  │
│  /overlay               │
└─────────────────────────┘
```

### Потоки данных

| Источник | Путь | Результат |
|---|---|---|
| Channel Points Redeem | Twitch EventSub → Bun Gateway → Rust State | Автоставка в очереди |
| `!bid 5000` в чате | Twitch EventSub → парсер → Rust State | Автоставка в очереди |
| Ручной ввод стримера | React UI → Tauri Command → Rust State | Ставка добавляется напрямую |
| Одобрение/отклонение | React UI → Tauri Command → Rust State → Bun SSE | Оверлей обновляется |

---

## 3. Функциональные требования

### 3.1 Лот

- Загрузка изображения (drag & drop или выбор файла)
- Название лота (текстовое поле)
- Стартовая цена (числовое поле, валюта: баллы канала или рублей — настраивается)
- Минимальный шаг ставки (абсолютный или процентный)
- Максимальная допустимая ставка (порог для авто-флага «нереалистичная»)

### 3.2 Таймер аукциона

- Настройка длительности (мм:сс)
- Старт / Пауза / Сброс из UI
- Опция «продление таймера при новой ставке за N секунд до конца» (snipe protection)
- По истечении — автоматическая блокировка приёма ставок

### 3.3 Ставки

#### Источники входящих ставок

**Channel Points (автоматически)**
- Twitch EventSub: `channel.channel_points_custom_reward_redemption.add`
- Сумма ставки = количество потраченных баллов ИЛИ парсится из поля `user_input` (формат: `3500`)

**Чат-команда (автоматически)**
- EventSub: `channel.chat.message`
- Паттерн: `!bid <число>` (команда настраивается)
- Дубликаты от одного пользователя — обновляют существующую ставку или создают новую (режим настраивается)

**Ручной ввод (стример)**
- Форма: никнейм + сумма
- Используется для донатов, офлайн-ставок, исправлений

#### Состояния ставки

```
pending → approved → winner
         ↓
       rejected
```

- `pending` — поступила, ждёт проверки (или авто-одобряется, если в рамках лимитов)
- `approved` — принята, видна в оверлее
- `rejected` — отклонена стримером, пользователю возвращаются баллы (через Twitch API)
- `winner` — победившая ставка после завершения таймера

#### Авто-флаг «нереалистичная ставка»

Ставка помечается флагом и уходит на ручное одобрение если:
- Превышает `max_bid_threshold` (задаётся в настройках)
- Отличается от текущей максимальной ставки более чем в N раз (настраивается)

### 3.4 Панель управления (React UI)

```
┌─────────────────────────────────────────────────────┐
│ [Изображение лота]  Название лота                   │
│                     Стартовая цена: 3000 ₽          │
│                     ⏱ 08:42  [▶ Старт] [⏸ Пауза]   │
├─────────────────────────────────────────────────────┤
│ СТАВКИ                              [+ Добавить]    │
│                                                     │
│ ⚠ boykisser       1 000 000  [✓ Одобрить] [✗ Откл]  │
│ ✓ alex13              5 000                         │
│ ✓ Luminesh            3 350                         │
│ ✓ ElectroSalt         3 200                         │
│                                                     │
│ Текущий лидер: alex13 — 5 000                       │
│                     [🏆 Завершить аукцион]           │
└─────────────────────────────────────────────────────┘
```

- Сортировка: по умолчанию — по убыванию суммы
- Фильтр: все / pending / approved
- Каждая строка: аватар (загружается из Twitch API), ник, сумма, кнопки действий
- Флаг ⚠ на нереалистичных ставках

### 3.5 Браузерный оверлей

URL: `http://localhost:3141/overlay`

Отображает:
- Изображение лота
- Текущую максимальную ставку и никнейм лидера
- Топ-N ставок (N настраивается, рекомендовано 3–5)
- Таймер (можно скрыть)
- Анимацию при появлении новой ставки

Обновление через **SSE** (`EventSource`) или **WebSocket** — без перезагрузки страницы.

---

## 4. Нефункциональные требования

| Параметр | Значение |
|---|---|
| Задержка обновления оверлея | < 500 мс от момента одобрения |
| Размер оверлея | 1920×1080, адаптируется через CSS-переменные |
| Оффлайн-режим | Приложение работает без интернета (только ручные ставки) |
| Сохранение состояния | Текущий аукцион сохраняется в `~/.config/twitch-auction/state.json` |
| История аукционов | Сохраняется в NDJSON-файл, экспорт в CSV |

---

## 5. Технический стек

### 5.1 Tauri 2 (Rust)

```toml
# Cargo.toml
[dependencies]
tauri = { version = "2", features = ["protocol-asset"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
```

**Tauri Commands (Rust ↔ React):**

```rust
#[tauri::command]
async fn get_auction_state(state: State<'_, AuctionState>) -> Result<AuctionDto, String>

#[tauri::command]
async fn approve_bid(bid_id: String, state: State<'_, AuctionState>) -> Result<(), String>

#[tauri::command]
async fn reject_bid(bid_id: String, state: State<'_, AuctionState>) -> Result<(), String>

#[tauri::command]
async fn add_manual_bid(username: String, amount: u64, state: State<'_, AuctionState>) -> Result<(), String>

#[tauri::command]
async fn start_auction(config: AuctionConfig, state: State<'_, AuctionState>) -> Result<(), String>

#[tauri::command]
async fn finish_auction(state: State<'_, AuctionState>) -> Result<WinnerDto, String>
```

**Tauri Events (Rust → React):**

```rust
// Эмитятся в WebView при изменениях состояния
app.emit("bid:new", BidPayload { ... });
app.emit("bid:updated", BidPayload { ... });
app.emit("timer:tick", TimerPayload { seconds_left: u32 });
app.emit("auction:finished", WinnerPayload { ... });
```

### 5.2 Bun Server (встроенный в Tauri через sidecar)

```typescript
// server/index.ts — запускается как Tauri sidecar
import { serve } from "bun";

const server = serve({
  port: 3141,
  fetch(req) {
    const url = new URL(req.url);

    // SSE endpoint для оверлея
    if (url.pathname === "/overlay/events") {
      return new Response(overlaySSEStream(), {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Статика оверлея
    if (url.pathname === "/overlay") {
      return new Response(Bun.file("./overlay/index.html"));
    }

    // REST API для прямых запросов
    if (url.pathname.startsWith("/api/")) {
      return handleAPI(req);
    }
  },
});
```

**SSE события оверлея:**

```
event: auction_state
data: {"lot":{"title":"...","image_url":"..."},"top_bids":[...],"timer_left":482,"leader":{"username":"alex13","amount":5000}}

event: bid_approved  
data: {"id":"uuid","username":"alex13","amount":5000,"rank":1}

event: bid_rejected
data: {"id":"uuid","username":"boykisser"}

event: timer_tick
data: {"seconds_left":481}

event: auction_finished
data: {"winner":{"username":"alex13","amount":5000}}
```

### 5.3 Twitch Gateway (Bun)

```typescript
// twitch/gateway.ts
import { EventSubWsListener } from "@twurple/eventsub-ws";
import { ApiClient } from "@twurple/api";
import { RefreshingAuthProvider } from "@twurple/auth";

// Подписки:
// - channel.channel_points_custom_reward_redemption.add  → авто-ставка через баллы
// - channel.chat.message                                → парсинг !bid команды
// - channel.chat.message (moderator)                   → управляющие команды
```

**OAuth flow:**

1. Приложение открывает системный браузер → Twitch OAuth
2. Redirect на `http://localhost:3141/auth/callback`
3. Bun сервер принимает `code`, обменивает на токены
4. Токены хранятся в `~/.config/twitch-auction/tokens.json`
5. `@twurple/auth` автоматически рефрешит токены

**Необходимые scopes:**
```
channel:read:redemptions
channel:manage:redemptions   (для возврата баллов)
chat:read
user:read:chat
moderator:read:chat_messages
```

### 5.4 Структуры данных

```typescript
interface AuctionConfig {
  lot_title: string;
  lot_image_path: string;
  starting_price: number;
  currency: "channel_points" | "custom";
  currency_label: string;        // "₽", "баллов", etc.
  duration_seconds: number;
  min_bid_step: number;          // абсолютный шаг
  min_bid_step_percent?: number; // процентный шаг (альтернатива)
  max_bid_threshold?: number;    // авто-флаг выше этой суммы
  unrealistic_multiplier: number; // флаг если ставка > текущий макс * N
  snipe_protection_seconds: number; // продление таймера при ставке в конце
  chat_command: string;          // default: "!bid"
  reward_id?: string;            // ID Channel Points reward
  top_bids_in_overlay: number;   // сколько ставок показывать (default: 5)
}

interface Bid {
  id: string;                    // uuid
  username: string;
  user_id: string;
  amount: number;
  source: "channel_points" | "chat_command" | "manual";
  status: "pending" | "approved" | "rejected" | "winner";
  is_flagged: boolean;           // авто-флаг нереалистичной ставки
  redemption_id?: string;        // для возврата баллов
  created_at: string;            // ISO 8601
  updated_at: string;
}

interface AuctionState {
  id: string;
  config: AuctionConfig;
  bids: Bid[];
  status: "idle" | "running" | "paused" | "finished";
  started_at?: string;
  finished_at?: string;
  winner_id?: string;
  timer_left_seconds: number;
}
```

### 5.5 React (Frontend)

```
src/
├── components/
│   ├── AuctionSetup/        # Форма настройки лота
│   ├── BidList/             # Таблица ставок с действиями
│   ├── Timer/               # Отображение и управление таймером
│   ├── LotPreview/          # Превью изображения и заголовок
│   └── ManualBidForm/       # Форма ручного добавления ставки
├── hooks/
│   ├── useAuction.ts        # Tauri event listener + команды
│   ├── useTwitchAuth.ts     # OAuth состояние
│   └── useTimer.ts          # Локальный countdown
├── store/
│   └── auctionStore.ts      # Zustand store
└── pages/
    ├── Setup.tsx            # Настройка до старта
    ├── Live.tsx             # Активный аукцион
    └── Results.tsx          # Итоги после завершения
```

**Стейт-менеджмент:** Zustand  
**Tauri события:** `@tauri-apps/api/event`

```typescript
// hooks/useAuction.ts
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

export function useAuction() {
  const store = useAuctionStore();

  useEffect(() => {
    const unlisten = listen<BidPayload>("bid:new", (e) => {
      store.addBid(e.payload);
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  const approveBid = (bidId: string) =>
    invoke("approve_bid", { bidId });

  const rejectBid = (bidId: string) =>
    invoke("reject_bid", { bidId });

  return { approveBid, rejectBid, ... };
}
```

---

## 6. Файловая структура проекта

```
twitch-auction/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   ├── commands.rs       # Tauri commands
│   │   ├── state.rs          # AuctionState + логика
│   │   └── sidecar.rs        # Запуск Bun sidecar
│   ├── binaries/
│   │   └── auction-server-*  # Скомпилированный Bun sidecar
│   └── Cargo.toml
├── server/                   # Bun sidecar
│   ├── src/
│   │   ├── index.ts          # HTTP/SSE сервер
│   │   ├── twitch/
│   │   │   ├── gateway.ts    # EventSub listener
│   │   │   ├── auth.ts       # OAuth flow
│   │   │   └── refund.ts     # Возврат Channel Points
│   │   └── overlay/
│   │       └── sse.ts        # SSE broadcaster
│   ├── overlay/              # Статика оверлея
│   │   ├── index.html
│   │   ├── overlay.ts        # EventSource клиент
│   │   └── styles.css
│   ├── package.json
│   └── bunfig.toml
├── src/                      # React приложение
│   ├── components/
│   ├── hooks/
│   ├── store/
│   └── pages/
├── public/
├── package.json
└── tauri.conf.json
```

---

## 7. Взаимодействие Bun Sidecar ↔ Rust

Bun-сервер запускается как **Tauri Sidecar** и общается с Rust-ядром через **stdin/stdout** (JSON-RPC или нативный IPC).

```rust
// src-tauri/src/sidecar.rs
use tauri::Manager;
use tauri_plugin_shell::ShellExt;

pub fn start_server(app: &AppHandle) {
    let sidecar = app.shell()
        .sidecar("auction-server")
        .unwrap()
        .spawn()
        .expect("Failed to start Bun server");
    
    // Слушаем stdout от Bun (входящие ставки)
    sidecar.stdout.on_event(|event| {
        if let CommandEvent::Stdout(line) = event {
            let bid: IncomingBid = serde_json::from_str(&line).unwrap();
            handle_incoming_bid(bid);
        }
    });
}
```

```typescript
// server/src/twitch/gateway.ts
// Отправляем ставки в Rust через stdout
process.stdout.write(JSON.stringify({
  type: "bid",
  username: redemption.userDisplayName,
  user_id: redemption.userId,
  amount: redemption.rewardCost,
  source: "channel_points",
  redemption_id: redemption.id,
}) + "\n");
```

---

## 8. Оверлей (Browser Source)

```html
<!-- overlay/index.html — подключается в OBS -->
<!DOCTYPE html>
<html>
<head>
  <style>
    /* Кастомизируется через URL-параметры или CSS-переменные */
    :root {
      --accent: #9147ff;  /* Twitch purple */
      --bg-opacity: 0.85;
    }
  </style>
</head>
<body>
  <div id="overlay">
    <div id="lot-image"></div>
    <div id="current-leader"></div>
    <div id="bid-list"></div>
    <div id="timer"></div>
  </div>
  <script type="module" src="./overlay.ts"></script>
</body>
</html>
```

```typescript
// overlay/overlay.ts
const es = new EventSource("http://localhost:3141/overlay/events");

es.addEventListener("auction_state", (e) => {
  const state = JSON.parse(e.data);
  renderState(state);
});

es.addEventListener("bid_approved", (e) => {
  const bid = JSON.parse(e.data);
  animateNewBid(bid); // slide-in анимация
});
```

---

## 9. Настройки приложения

Хранятся в `~/.config/twitch-auction/settings.json`:

```json
{
  "twitch": {
    "client_id": "...",
    "channel_login": "streamer_name",
    "channel_id": "..."
  },
  "overlay": {
    "port": 3141,
    "theme": "default",
    "show_timer": true,
    "top_bids_count": 5,
    "animation": "slide"
  },
  "auction_defaults": {
    "duration_seconds": 600,
    "min_bid_step": 100,
    "unrealistic_multiplier": 10,
    "snipe_protection_seconds": 30,
    "chat_command": "!bid",
    "auto_approve": true,
    "auto_approve_threshold": 50000
  }
}
```

---

## 10. Этапы разработки

### Этап 1 — MVP (ручной режим)
- [ ] Tauri-приложение с React UI
- [ ] Форма создания лота + загрузка изображения
- [ ] Таймер с паузой
- [ ] Ручное добавление ставок
- [ ] Список ставок с одобрением/отклонением
- [ ] Bun SSE-сервер
- [ ] Браузерный оверлей (базовый)

### Этап 2 — Twitch интеграция
- [ ] OAuth авторизация через Twitch
- [ ] EventSub: Channel Points Redemption
- [ ] EventSub: Chat command `!bid`
- [ ] Авто-флаг нереалистичных ставок
- [ ] Возврат баллов при отклонении ставки

### Этап 3 — Полировка
- [ ] Snipe protection (продление таймера)
- [ ] История аукционов + экспорт CSV
- [ ] Кастомизация оверлея (темы, параметры через URL)
- [ ] Звуковые уведомления (новая ставка, победитель)
- [ ] Мультилот (очередь аукционов)

---

## 11. Зависимости

### Rust (Cargo)
```toml
tauri = "2"
tauri-plugin-shell = "2"   # для sidecar
serde = { features = ["derive"] }
serde_json = "1"
tokio = { features = ["full"] }
uuid = { features = ["v4"] }
```

### Bun / Node (server/)
```json
{
  "dependencies": {
    "@twurple/api": "^7",
    "@twurple/auth": "^7",
    "@twurple/eventsub-ws": "^7"
  }
}
```

### React (src/)
```json
{
  "dependencies": {
    "@tauri-apps/api": "^2",
    "@tauri-apps/plugin-shell": "^2",
    "react": "^19",
    "zustand": "^5",
    "tailwindcss": "^4"
  }
}
```

---

## 12. Что реалистично, что нет

| Фича | Оценка | Комментарий |
|---|---|---|
| SSE-оверлей в OBS | ✅ Просто | Стандартный Browser Source |
| Авто-ставки через Channel Points | ✅ Реально | EventSub стабильный |
| Возврат баллов при отклонении | ✅ Реально | `channel:manage:redemptions` |
| Парсинг !bid в чате | ✅ Просто | |
| Bun sidecar в Tauri | ✅ Реально | Tauri 2 поддерживает sidecar |
| Авто-флаг нереалистичных ставок | ✅ Тривиально | Простая проверка порога |
| Snipe protection | ✅ Просто | setTimeout пересчёт |
| Возврат баллов в реальном времени | ⚠️ Нюанс | Нужен moderator scope, лимиты API |
| Полностью кастомный оверлей | ⚠️ Средне | CSS-переменные покроют 90% кейсов |
