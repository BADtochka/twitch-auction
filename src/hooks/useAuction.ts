import { invoke } from "@tauri-apps/api/core";
import { type AuctionConfig, type AuctionData, type Bid } from "../store/auctionStore";

export function useAuction() {
  const startAuction = (config: AuctionConfig) =>
    invoke<AuctionData>("start_auction", { config });

  const pauseAuction = () => invoke("pause_auction");

  const finishAuction = () => invoke<Bid | null>("finish_auction");

  const approveBid = (bidId: string) => invoke("approve_bid", { bidId });

  const rejectBid = (bidId: string) => invoke("reject_bid", { bidId });

  const addManualBid = (username: string, amount: number) =>
    invoke("add_manual_bid", { username, amount });

  return { startAuction, pauseAuction, finishAuction, approveBid, rejectBid, addManualBid };
}
