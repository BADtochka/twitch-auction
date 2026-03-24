import { create } from "zustand";

export type BidStatus = "pending" | "approved" | "rejected" | "winner";
export type BidSource = "channel_points" | "chat_command" | "manual";
export type AuctionStatus = "idle" | "running" | "paused" | "finished";

export interface Bid {
  id: string;
  username: string;
  user_id: string;
  amount: number;
  source: BidSource;
  status: BidStatus;
  is_flagged: boolean;
  redemption_id?: string;
  created_at: string;
  updated_at: string;
}

export interface AuctionConfig {
  lot_title: string;
  show_lot_title: boolean;
  lot_image_path: string;
  lot_image_scale: number;
  starting_price: number;
  currency: "channel_points" | "custom";
  currency_label: string;
  duration_seconds: number;
  min_bid_step: number;
  min_bid_step_percent?: number;
  max_bid_threshold?: number;
  unrealistic_multiplier: number;
  snipe_protection_seconds: number;
  chat_command: string;
  disable_chat_when_reward: boolean;
  reward_id?: string;
  top_bids_in_overlay: number;
  widgets_show_after_finished: string[];
}

export interface AuctionData {
  id: string;
  config: AuctionConfig;
  bids: Bid[];
  status: AuctionStatus;
  started_at?: string;
  finished_at?: string;
  winner_id?: string;
  timer_left_seconds: number;
}

interface AuctionStore {
  auction: AuctionData | null;
  setAuction: (auction: AuctionData) => void;
  addBid: (bid: Bid) => void;
  updateBid: (bid: Bid) => void;
  setTimerLeft: (seconds: number) => void;
  setStatus: (status: AuctionStatus) => void;
  setWidgetsShowAfterFinished: (ids: string[]) => void;
}

export const useAuctionStore = create<AuctionStore>((set) => ({
  auction: null,

  setAuction: (auction) => set({ auction }),

  addBid: (bid) =>
    set((s) => {
      if (!s.auction) return s;
      return { auction: { ...s.auction, bids: [...s.auction.bids, bid] } };
    }),

  updateBid: (bid) =>
    set((s) => {
      if (!s.auction) return s;
      return {
        auction: {
          ...s.auction,
          bids: s.auction.bids.map((b) => (b.id === bid.id ? bid : b)),
        },
      };
    }),

  setTimerLeft: (seconds) =>
    set((s) => {
      if (!s.auction) return s;
      return { auction: { ...s.auction, timer_left_seconds: seconds } };
    }),

  setStatus: (status) =>
    set((s) => {
      if (!s.auction) return s;
      return { auction: { ...s.auction, status } };
    }),

  setWidgetsShowAfterFinished: (ids) =>
    set((s) => {
      if (!s.auction) return s;
      return { auction: { ...s.auction, config: { ...s.auction.config, widgets_show_after_finished: ids } } };
    }),
}));
