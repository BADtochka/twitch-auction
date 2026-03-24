import { ApiClient } from "@twurple/api";

// Called when Rust signals a bid rejection that needs a Channel Points refund
export async function refundRedemption(
  apiClient: ApiClient,
  broadcasterId: string,
  rewardId: string,
  redemptionId: string
) {
  try {
    await apiClient.channelPoints.updateRedemptionStatusByIds(
      broadcasterId,
      rewardId,
      [redemptionId],
      "CANCELED"
    );
  } catch (err) {
    console.error("[refund] Failed to refund redemption", redemptionId, err);
  }
}
