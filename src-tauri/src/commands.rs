use base64::Engine as _;
use std::process::Command;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::time::{sleep, Duration};

use crate::sidecar::write_to_server;
use crate::state::{AuctionConfig, AuctionData, AuctionState, AuctionStatus, Bid, BidSource, BidStatus};

fn write_state_file(data: &AuctionData) {
    if let Ok(json) = serde_json::to_string(data) {
        let home = std::env::var("HOME")
            .or_else(|_| std::env::var("USERPROFILE"))
            .unwrap_or_default();
        let path = std::path::Path::new(&home)
            .join(".config/twitch-auction/auction-state.json");
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let _ = std::fs::write(path, json);
    }
}

fn push_overlay_state(app: &AppHandle, data: &AuctionData) {
    let msg = serde_json::json!({ "type": "overlay:state", "data": data });
    write_to_server(app, &msg.to_string());
    write_state_file(data);
}

#[tauri::command]
pub async fn pick_image() -> Result<Option<String>, String> {
    let handle = rfd::AsyncFileDialog::new()
        .add_filter("Images", &["png", "jpg", "jpeg", "webp", "gif"])
        .pick_file()
        .await;

    let Some(file) = handle else { return Ok(None) };

    let bytes = std::fs::read(file.path()).map_err(|e| e.to_string())?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);

    let ext = file.path()
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png")
        .to_lowercase();
    let mime = match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "gif"          => "image/gif",
        "webp"         => "image/webp",
        _              => "image/png",
    };

    Ok(Some(format!("data:{mime};base64,{b64}")))
}

#[tauri::command]
pub async fn open_url(url: String, app: AppHandle) -> Result<(), String> {
    #[cfg(not(debug_assertions))]
    {
        use tauri_plugin_opener::OpenerExt;
        app.opener().open_url(&url, None::<&str>).map_err(|e| e.to_string())?;
    }
    #[cfg(debug_assertions)]
    {
        let _ = &app;
        // Try xdg-open first; fall back to powershell.exe for WSL
        if Command::new("xdg-open").arg(&url).status().is_err() {
            Command::new("powershell.exe")
                .args(["-c", &format!("Start-Process '{url}'")])
                .status()
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn get_auction_state(state: State<'_, AuctionState>) -> Result<AuctionData, String> {
    let data = state.0.lock().map_err(|e| e.to_string())?;
    Ok(data.clone())
}

#[tauri::command]
pub async fn start_auction(
    config: AuctionConfig,
    app: AppHandle,
    state: State<'_, AuctionState>,
) -> Result<(), String> {
    let auction_id = {
        let mut data = state.0.lock().map_err(|e| e.to_string())?;
        let show_after = data.config.widgets_show_after_finished.clone();
        data.config = config;
        data.config.widgets_show_after_finished = show_after;
        data.timer_left_seconds = data.config.duration_seconds;
        data.status = AuctionStatus::Running;
        data.bids.clear();
        data.winner_id = None;
        data.id = uuid::Uuid::new_v4().to_string();
        let id = data.id.clone();
        app.emit("auction:started", data.clone()).ok();
        push_overlay_state(&app, &data);
        id
    };

    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        loop {
            sleep(Duration::from_secs(1)).await;

            let state = app_clone.state::<AuctionState>();
            let Ok(mut data) = state.0.lock() else { break };

            if data.id != auction_id { break; }
            if data.status == AuctionStatus::Finished { break; }
            if data.status != AuctionStatus::Running { continue; } // paused — skip tick

            if data.timer_left_seconds > 0 {
                data.timer_left_seconds -= 1;
            }
            let timer_left = data.timer_left_seconds;
            drop(data);

            app_clone.emit("timer:tick", serde_json::json!({ "seconds_left": timer_left })).ok();

            let tick_msg = serde_json::json!({
                "type": "timer:tick",
                "data": { "seconds_left": timer_left }
            });
            write_to_server(&app_clone, &tick_msg.to_string());

            if timer_left == 0 {
                break;
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn pause_auction(app: AppHandle, state: State<'_, AuctionState>) -> Result<(), String> {
    let mut data = state.0.lock().map_err(|e| e.to_string())?;
    data.status = match data.status {
        AuctionStatus::Running => AuctionStatus::Paused,
        AuctionStatus::Paused => AuctionStatus::Running,
        ref s => return Err(format!("Cannot pause in state {s:?}")),
    };
    app.emit("auction:status", serde_json::json!({ "status": data.status })).ok();
    push_overlay_state(&app, &data);
    Ok(())
}

#[tauri::command]
pub async fn finish_auction(
    app: AppHandle,
    state: State<'_, AuctionState>,
) -> Result<Option<Bid>, String> {
    let mut data = state.0.lock().map_err(|e| e.to_string())?;
    data.status = AuctionStatus::Finished;

    let winner = data.max_approved_bid().cloned();
    if let Some(ref w) = winner {
        data.winner_id = Some(w.id.clone());
        if let Some(bid) = data.bids.iter_mut().find(|b| b.id == w.id) {
            bid.status = BidStatus::Winner;
        }
    }

    // Re-fetch the winner from the updated bids array so status is "winner", not "approved"
    let winner_emit = winner.as_ref()
        .and_then(|w| data.bids.iter().find(|b| b.id == w.id))
        .cloned();
    app.emit("auction:finished", winner_emit).ok();

    let finished_data = serde_json::json!({
        "username": winner.as_ref().map(|w| &w.username),
        "amount": winner.as_ref().map(|w| w.amount)
    });
    let msg = serde_json::json!({ "type": "auction:finished", "data": finished_data });
    write_to_server(&app, &msg.to_string());
    push_overlay_state(&app, &data);

    Ok(winner)
}

#[tauri::command]
pub async fn approve_bid(
    bid_id: String,
    app: AppHandle,
    state: State<'_, AuctionState>,
) -> Result<(), String> {
    let mut data = state.0.lock().map_err(|e| e.to_string())?;
    let bid = data
        .bids
        .iter_mut()
        .find(|b| b.id == bid_id)
        .ok_or("Bid not found")?;
    bid.status = BidStatus::Approved;
    bid.is_flagged = false;
    app.emit("bid:updated", bid.clone()).ok();
    push_overlay_state(&app, &data);
    Ok(())
}

#[tauri::command]
pub async fn reject_bid(
    bid_id: String,
    app: AppHandle,
    state: State<'_, AuctionState>,
) -> Result<(), String> {
    let mut data = state.0.lock().map_err(|e| e.to_string())?;
    let bid = data
        .bids
        .iter_mut()
        .find(|b| b.id == bid_id)
        .ok_or("Bid not found")?;
    bid.status = BidStatus::Rejected;
    app.emit("bid:updated", bid.clone()).ok();
    push_overlay_state(&app, &data);
    Ok(())
}

#[tauri::command]
pub async fn add_manual_bid(
    username: String,
    amount: u64,
    app: AppHandle,
    state: State<'_, AuctionState>,
) -> Result<(), String> {
    let mut data = state.0.lock().map_err(|e| e.to_string())?;
    if data.status != AuctionStatus::Running {
        return Err("Auction is not running".into());
    }
    let flagged = data.is_flagged(amount);
    let mut bid = Bid::new(username, "manual".into(), amount, BidSource::Manual);
    bid.is_flagged = flagged;
    bid.status = if flagged {
        BidStatus::Pending
    } else {
        BidStatus::Approved
    };
    app.emit("bid:new", bid.clone()).ok();
    data.bids.push(bid);
    push_overlay_state(&app, &data);
    Ok(())
}

#[tauri::command]
pub async fn set_widgets_show_after_finished(
    ids: Vec<String>,
    app: AppHandle,
    state: State<'_, AuctionState>,
) -> Result<(), String> {
    let mut data = state.0.lock().map_err(|e| e.to_string())?;
    data.config.widgets_show_after_finished = ids;
    push_overlay_state(&app, &data);
    Ok(())
}
