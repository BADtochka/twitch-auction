use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

pub fn write_to_server(app: &AppHandle, msg: &str) {
    if let Ok(mut guard) = app.state::<crate::ServerChild>().0.lock() {
        if let Some(child) = guard.as_mut() {
            let line = format!("{}\n", msg);
            let _ = child.write(line.as_bytes());
        }
    }
}

use crate::state::{AuctionState, Bid, BidSource, BidStatus};

#[derive(serde::Deserialize)]
struct IncomingMessage {
    #[serde(rename = "type")]
    msg_type: String,
    username: Option<String>,
    user_id: Option<String>,
    amount: Option<u64>,
    source: Option<String>,
    redemption_id: Option<String>,
    reward_id: Option<String>,
    avatar_url: Option<String>,
}

pub fn start_server(app: AppHandle) -> tauri_plugin_shell::process::CommandChild {
    let sidecar = app
        .shell()
        .sidecar("auction-server")
        .expect("auction-server sidecar not found");

    let (mut rx, child) = sidecar.spawn().expect("Failed to start Bun server");

    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let text = String::from_utf8_lossy(&line);
                    if let Ok(msg) = serde_json::from_str::<IncomingMessage>(&text) {
                        handle_incoming(&app_clone, msg).await;
                    }
                }
                CommandEvent::Stderr(line) => {
                    eprintln!("[sidecar] {}", String::from_utf8_lossy(&line));
                }
                _ => {}
            }
        }
    });

    child
}

async fn handle_incoming(app: &AppHandle, msg: IncomingMessage) {
    if msg.msg_type != "bid" {
        return;
    }
    let Some(username) = msg.username else { return };
    let Some(user_id) = msg.user_id else { return };
    let Some(amount) = msg.amount else { return };

    let source = match msg.source.as_deref() {
        Some("channel_points") => BidSource::ChannelPoints,
        Some("chat_command") => BidSource::ChatCommand,
        _ => BidSource::Manual,
    };

    let state = app.state::<AuctionState>();
    let Ok(mut data) = state.0.lock() else { return };

    // Filter channel_points bids by configured reward_id
    if source == BidSource::ChannelPoints {
        if let Some(ref required_id) = data.config.reward_id {
            if msg.reward_id.as_deref() != Some(required_id.as_str()) {
                return;
            }
        }
    }

    // Optionally block chat commands when a reward is active
    if source == BidSource::ChatCommand
        && data.config.disable_chat_when_reward
        && data.config.reward_id.is_some()
    {
        return;
    }

    // Reject bids below the minimum required amount
    let min_required = data.min_required_bid();
    if amount < min_required {
        let refund_msg = serde_json::json!({
            "type": "bid:too_low",
            "username": username,
            "amount": amount,
            "min_required": min_required,
            "redemption_id": msg.redemption_id,
            "reward_id": msg.reward_id,
        });
        drop(data);
        write_to_server(app, &refund_msg.to_string());
        return;
    }

    let flagged = data.is_flagged(amount);
    let mut bid = Bid::new(username, user_id, amount, source);
    bid.is_flagged = flagged;
    bid.redemption_id = msg.redemption_id;
    bid.avatar_url = msg.avatar_url;
    bid.status = if flagged {
        BidStatus::Pending
    } else {
        BidStatus::Approved
    };

    app.emit("bid:new", bid.clone()).ok();
    data.bids.push(bid);

    let msg = serde_json::json!({ "type": "overlay:state", "data": data.clone() });
    drop(data);
    write_to_server(app, &msg.to_string());
}
