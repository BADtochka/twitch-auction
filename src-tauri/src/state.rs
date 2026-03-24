use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use uuid::Uuid;

fn bool_true() -> bool { true }
fn default_image_scale() -> f64 { 1.0 }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuctionConfig {
    pub lot_title: String,
    #[serde(default = "bool_true")]
    pub show_lot_title: bool,
    pub lot_image_path: String,
    #[serde(default = "default_image_scale")]
    pub lot_image_scale: f64,
    pub starting_price: u64,
    pub currency: String, // "channel_points" | "custom"
    pub currency_label: String,
    pub duration_seconds: u64,
    pub min_bid_step: u64,
    pub min_bid_step_percent: Option<f64>,
    pub max_bid_threshold: Option<u64>,
    pub unrealistic_multiplier: f64,
    pub snipe_protection_seconds: u64,
    pub chat_command: String,
    #[serde(default)]
    pub disable_chat_when_reward: bool,
    pub reward_id: Option<String>,
    pub top_bids_in_overlay: usize,
    #[serde(default)]
    pub widgets_show_after_finished: Vec<String>,
}

impl Default for AuctionConfig {
    fn default() -> Self {
        Self {
            lot_title: String::new(),
            show_lot_title: true,
            lot_image_path: String::new(),
            lot_image_scale: 1.0,
            starting_price: 0,
            currency: "channel_points".into(),
            currency_label: "₽".into(),
            duration_seconds: 600,
            min_bid_step: 100,
            min_bid_step_percent: None,
            max_bid_threshold: None,
            unrealistic_multiplier: 10.0,
            snipe_protection_seconds: 30,
            chat_command: "!bid".into(),
            disable_chat_when_reward: false,
            reward_id: None,
            top_bids_in_overlay: 5,
            widgets_show_after_finished: vec!["overlay".into(), "winner".into()],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum BidStatus {
    Pending,
    Approved,
    Rejected,
    Winner,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum BidSource {
    ChannelPoints,
    ChatCommand,
    Manual,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bid {
    pub id: String,
    pub username: String,
    pub user_id: String,
    pub amount: u64,
    pub source: BidSource,
    pub status: BidStatus,
    pub is_flagged: bool,
    pub redemption_id: Option<String>,
    pub avatar_url: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl Bid {
    pub fn new(username: String, user_id: String, amount: u64, source: BidSource) -> Self {
        let now = chrono_now();
        Self {
            id: Uuid::new_v4().to_string(),
            username,
            user_id,
            amount,
            source,
            status: BidStatus::Pending,
            is_flagged: false,
            redemption_id: None,
            avatar_url: None,
            created_at: now.clone(),
            updated_at: now,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AuctionStatus {
    Idle,
    Running,
    Paused,
    Finished,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuctionData {
    pub id: String,
    pub config: AuctionConfig,
    pub bids: Vec<Bid>,
    pub status: AuctionStatus,
    pub started_at: Option<String>,
    pub finished_at: Option<String>,
    pub winner_id: Option<String>,
    pub timer_left_seconds: u64,
}

impl Default for AuctionData {
    fn default() -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            config: AuctionConfig::default(),
            bids: Vec::new(),
            status: AuctionStatus::Idle,
            started_at: None,
            finished_at: None,
            winner_id: None,
            timer_left_seconds: 600,
        }
    }
}

impl AuctionData {
    pub fn max_approved_bid(&self) -> Option<&Bid> {
        self.bids
            .iter()
            .filter(|b| b.status == BidStatus::Approved)
            .max_by_key(|b| b.amount)
    }

    pub fn min_required_bid(&self) -> u64 {
        match self.max_approved_bid() {
            Some(max_bid) => {
                let step = if let Some(pct) = self.config.min_bid_step_percent {
                    ((max_bid.amount as f64 * pct / 100.0).ceil() as u64).max(self.config.min_bid_step)
                } else {
                    self.config.min_bid_step
                };
                max_bid.amount + step.max(1)
            }
            None => self.config.starting_price,
        }
    }

    pub fn is_flagged(&self, amount: u64) -> bool {
        if let Some(threshold) = self.config.max_bid_threshold {
            if amount > threshold {
                return true;
            }
        }
        if let Some(max_bid) = self.max_approved_bid() {
            if amount > (max_bid.amount as f64 * self.config.unrealistic_multiplier) as u64 {
                return true;
            }
        }
        false
    }
}

#[derive(Default)]
pub struct AuctionState(pub Mutex<AuctionData>);

fn chrono_now() -> String {
    // Simple ISO 8601 timestamp — swap for chrono if added as dep
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{}", secs)
}
