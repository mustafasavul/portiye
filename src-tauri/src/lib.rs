mod avd;
mod export;
mod ports;
mod runtimes;
mod sim;
mod tray;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            ports::get_listening_ports,
            ports::kill_process,
            ports::kill_processes,
            ports::kill_processes_elevated,
            avd::list_avds,
            avd::launch_avd,
            avd::stop_avd,
            avd::wipe_avd,
            avd::restart_avd,
            sim::list_simulators,
            sim::boot_simulator,
            sim::shutdown_simulator,
            sim::erase_simulator,
            sim::restart_simulator,
            export::export_snapshot,
            runtimes::list_runtimes,
            runtimes::runtime_action,
        ])
        .setup(|app| {
            tray::init(app.handle())?;
            Ok(())
        })
        // Closing the window keeps the tray running instead of quitting.
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
