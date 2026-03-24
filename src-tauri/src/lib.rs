mod commands;
mod sidecar;
mod state;

use std::sync::Mutex;
use state::AuctionState;
use tauri::Manager;
use tauri_plugin_shell::process::CommandChild;

pub struct ServerChild(pub Mutex<Option<CommandChild>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AuctionState::default())
        .invoke_handler(tauri::generate_handler![
            commands::pick_image,
            commands::open_url,
            commands::get_auction_state,
            commands::start_auction,
            commands::pause_auction,
            commands::finish_auction,
            commands::approve_bid,
            commands::reject_bid,
            commands::add_manual_bid,
            commands::set_widgets_show_after_finished,
        ])
        .setup(|app| {
            let child = sidecar::start_server(app.handle().clone());
            app.manage(ServerChild(Mutex::new(Some(child))));
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                if let Ok(mut child) = app.state::<ServerChild>().0.lock() {
                    if let Some(c) = child.take() {
                        let _ = c.kill();
                    }
                }
            }
        });
}
