import { ApiClient } from "@twurple/api";
import { AppTokenAuthProvider, RefreshingAuthProvider } from "@twurple/auth";
import { EventSubWsListener } from "@twurple/eventsub-ws";
import { readSettings } from "../settings";
import { log } from "../logger";

const avatarCache = new Map<string, string>();

let currentChatCommand = "!bid";
export function setChatCommand(cmd: string) { currentChatCommand = cmd; }

let _apiClient: ApiClient | undefined;
let _channelId: string | undefined;

export async function refundAndNotify(
  redemptionId: string,
  rewardId: string,
  username: string,
  minRequired: number
): Promise<void> {
  if (!_apiClient || !_channelId) return;
  const { refundRedemption } = await import("./refund");
  try {
    await refundRedemption(_apiClient, _channelId, rewardId, redemptionId);
  } catch (err) {
    log('warn', `[gateway] Failed to refund redemption ${redemptionId}: ${err instanceof Error ? err.message : err}`);
  }
  await notifyTooLow(username, minRequired);
}

export async function notifyTooLow(username: string, minRequired: number): Promise<void> {
  if (!_apiClient || !_channelId) return;
  try {
    await _apiClient.chat.sendChatMessage(
      _channelId,
      `@${username}, ставка отклонена — минимальная ставка: ${minRequired.toLocaleString("ru-RU")}`
    );
  } catch (err) {
    log('warn', `[gateway] Failed to send chat notification: ${err instanceof Error ? err.message : err}`);
  }
}

export async function notifyRejected(
  username: string,
  amount: number,
  redemptionId?: string,
  rewardId?: string,
): Promise<void> {
  if (!_apiClient || !_channelId) return;
  if (redemptionId && rewardId) {
    const { refundRedemption } = await import("./refund");
    try {
      await refundRedemption(_apiClient, _channelId, rewardId, redemptionId);
    } catch (err) {
      log('warn', `[gateway] Failed to refund redemption ${redemptionId}: ${err instanceof Error ? err.message : err}`);
    }
  }
  try {
    await _apiClient.chat.sendChatMessage(
      _channelId,
      `@${username}, ставка ${amount.toLocaleString("ru-RU")} отклонена`
    );
  } catch (err) {
    log('warn', `[gateway] Failed to send rejection notification: ${err instanceof Error ? err.message : err}`);
  }
}

export async function notifyWinner(username: string, amount: number): Promise<void> {
  if (!_apiClient || !_channelId) return;
  try {
    await _apiClient.chat.sendChatMessage(
      _channelId,
      `@${username} побеждает со ставкой ${amount.toLocaleString("ru-RU")}! Поздравляем!`
    );
  } catch (err) {
    log('warn', `[gateway] Failed to send winner notification: ${err instanceof Error ? err.message : err}`);
  }
}

async function fetchAvatar(apiClient: ApiClient, userId: string): Promise<string | undefined> {
  if (avatarCache.has(userId)) return avatarCache.get(userId);
  try {
    const user = await apiClient.users.getUserById(userId);
    if (user?.profilePictureUrl) {
      avatarCache.set(userId, user.profilePictureUrl);
      return user.profilePictureUrl;
    }
  } catch {}
  return undefined;
}

export async function startTwitchGateway(): Promise<EventSubWsListener | undefined> {
  const settings = await readSettings();
  const { client_id, client_secret, channel_id } = settings.twitch ?? {};
  const tokens = settings.tokens;

  if (!client_id || !client_secret || !channel_id || !tokens) {
    console.error("[gateway] Twitch not configured, skipping");
    return undefined;
  }

  const authProvider = new RefreshingAuthProvider({ clientId: client_id, clientSecret: client_secret });
  await authProvider.addUserForToken(
    {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      obtainmentTimestamp: tokens.obtained_at,
    },
    ["chat"]
  );

  const apiClient = new ApiClient({ authProvider });
  _apiClient = apiClient;
  _channelId = channel_id;

  // Clean up stale subscriptions using app token
  try {
    const appAuth   = new AppTokenAuthProvider(client_id, client_secret);
    const appClient = new ApiClient({ authProvider: appAuth });
    // deleteAllSubscriptions iterates all pages via paginator — more reliable than getSubscriptions()
    const before = await appClient.eventSub.getSubscriptions();
    console.error(`[gateway] EventSub before cleanup: total=${before.total} data=${before.data.length}`);
    for (const sub of before.data) {
      console.error(`[gateway]   ${sub.type} status=${sub.status} id=${sub.id}`);
    }
    await appClient.eventSub.deleteAllSubscriptions();

    // Poll until Twitch confirms all subscriptions are gone (max 15s)
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const remaining = await appClient.eventSub.getSubscriptions();
      if (remaining.total === 0) break;
      console.error(`[gateway] Waiting for ${remaining.total} subscription(s) to clear...`);
      await Bun.sleep(1500);
    }
    console.error("[gateway] Subscriptions cleared, starting listener");
  } catch (e) {
    console.error("[gateway] Failed to clean up stale subscriptions:", e);
  }

  const listener = new EventSubWsListener({ apiClient });

  // Channel Points redemption → bid
  listener.onChannelRedemptionAdd(channel_id, async (event) => {
    // Try to parse bid amount from the user's message; fall back to reward cost
    const rawInput = event.input?.trim() ?? '';
    const digits   = rawInput.replace(/[^\d]/g, '');
    const parsed   = digits ? parseInt(digits, 10) : NaN;
    const amount   = !isNaN(parsed) && parsed > 0 ? parsed : event.rewardCost;

    log('info', `[gateway] Channel Points bid: ${event.userDisplayName} → ${amount} (input="${rawInput}", cost=${event.rewardCost})`);
    const avatar_url = await fetchAvatar(apiClient, event.userId);
    sendBid({
      username: event.userDisplayName,
      user_id: event.userId,
      amount,
      source: "channel_points",
      redemption_id: event.id,
      reward_id: event.rewardId,
      avatar_url,
    });
  });

  // Chat !bid command
  currentChatCommand = settings.auction_defaults?.chat_command ?? "!bid";
  listener.onChannelChatMessage(channel_id, channel_id, async (event) => {
    const text = event.messageText.trim();
    log('info', `[gateway] Chat message: ${event.chatterDisplayName}: ${text}`);
    if (!text.startsWith(currentChatCommand + " ")) return;
    const raw = text.slice(currentChatCommand.length).trim().replace(/[.,]/g, '');
    const amount = parseInt(raw, 10);
    if (isNaN(amount) || amount <= 0) return;
    const avatar_url = await fetchAvatar(apiClient, event.chatterId);
    log('info', `[gateway] Chat bid: ${event.chatterDisplayName} → ${amount}`);
    sendBid({
      username: event.chatterDisplayName,
      user_id: event.chatterId,
      amount,
      source: "chat_command",
      avatar_url,
    });
  });

  listener.start();
  console.error("[gateway] Twitch EventSub listener started");
  return listener;
}

interface BidMessage {
  username: string;
  user_id: string;
  amount: number;
  source: "channel_points" | "chat_command" | "manual";
  redemption_id?: string;
  reward_id?: string;
  avatar_url?: string;
}

function sendBid(bid: BidMessage) {
  process.stdout.write(JSON.stringify({ type: "bid", ...bid }) + "\n");
}
