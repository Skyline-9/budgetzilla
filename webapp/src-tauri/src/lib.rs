mod plaid_companion;

use plaid_companion::{CompanionLauncher, CompanionStatus};
use std::sync::Mutex;
use tauri::Manager;

#[tauri::command]
fn start_plaid_companion(
  launcher: tauri::State<'_, Mutex<CompanionLauncher>>,
) -> Result<CompanionStatus, String> {
  launcher
    .lock()
    .map_err(|_| "Plaid companion launcher is unavailable".to_string())?
    .start()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(Mutex::new(CompanionLauncher::default()))
    .invoke_handler(tauri::generate_handler![start_plaid_companion])
    .plugin(tauri_plugin_sql::Builder::new().build())
    .plugin(tauri_plugin_os::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      // Start during native setup so the frontend receives the port and
      // one-time code through the command bridge, never through app logs.
      if let Ok(mut launcher) = app.state::<Mutex<CompanionLauncher>>().lock() {
        // Plaid is optional; report startup failure through the command when
        // the frontend asks for the companion, without blocking app startup.
        let _ = launcher.start();
      }
      Ok(())
    })
    .on_window_event(|window, event| {
      if let tauri::WindowEvent::Destroyed = event {
        if let Some(launcher) = window.try_state::<Mutex<CompanionLauncher>>() {
          if let Ok(mut launcher) = launcher.lock() {
            launcher.stop();
          }
        }
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
