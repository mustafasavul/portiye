//! Native system-tray / menu-bar menu listing the listening ports.
//!
//! Native menu instead of a second webview: no extra window to position, and
//! it looks right on all three platforms for free.

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, Runtime};

pub const TRAY_ID: &str = "portiye-tray";

/// Menu ids are `kill:<pid>` so the click handler needs no shared state.
fn build_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let menu = Menu::new(app)?;

    match crate::ports::get_listening_ports() {
        Ok(ports) if !ports.is_empty() => {
            for p in ports {
                menu.append(&MenuItem::with_id(
                    app,
                    format!("kill:{}", p.pid),
                    format!(
                        ":{}  {}  —  {} MB  (pid {})",
                        p.port,
                        if p.detail.is_empty() {
                            p.name.clone()
                        } else {
                            format!("{} · {}", p.name, p.detail)
                        },
                        p.memory / 1_048_576,
                        p.pid
                    ),
                    true,
                    None::<&str>,
                )?)?;
            }
        }
        Ok(_) => menu.append(&MenuItem::with_id(
            app,
            "none",
            "No listening ports",
            false,
            None::<&str>,
        )?)?,
        Err(e) => menu.append(&MenuItem::with_id(app, "err", e, false, None::<&str>)?)?,
    }

    // Devices: the other half of the app, reachable without opening the window.
    // Only the ones that can be toggled from here — a stopped simulator needs
    // Simulator.app to come forward anyway, which the boot command handles.
    let devices = device_items();
    if !devices.is_empty() {
        menu.append(&PredefinedMenuItem::separator(app)?)?;
        for (id, label) in devices {
            menu.append(&MenuItem::with_id(app, id, label, true, None::<&str>)?)?;
        }
    }

    menu.append(&PredefinedMenuItem::separator(app)?)?;
    menu.append(&MenuItem::with_id(app, "show", "Open portiye…", true, None::<&str>)?)?;
    menu.append(&MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?)?;
    Ok(menu)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The tray builds its menu on the main thread during startup, so anything
    /// that panics here takes the whole app down before a window appears. This
    /// runs the real code path; on a machine without the SDKs it simply
    /// returns an empty list, which is also the contract.
    #[test]
    fn device_items_never_panics_and_encodes_its_action() {
        for (id, label) in device_items() {
            let (kind, rest) = id.split_once(':').expect("id carries a kind");
            assert!(matches!(kind, "avd" | "sim"), "unexpected kind {kind}");
            let (action, target) = rest.split_once(':').expect("id carries an action");
            assert!(matches!(action, "start" | "stop"), "unexpected action {action}");
            assert!(!target.is_empty(), "every entry names a target");
            assert!(!label.is_empty(), "every entry has a label");
        }
    }
}

/// `(menu id, label)` for every emulator and simulator.
///
/// Ids encode the action so the click handler stays stateless, exactly like
/// the `kill:<pid>` entries above: `avd:<start|stop>:<name-or-serial>`.
fn device_items() -> Vec<(String, String)> {
    let mut items = Vec::new();

    for avd in crate::avd::list_avds().unwrap_or_default() {
        let pretty = avd.name.replace('_', " ");
        items.push(match &avd.serial {
            Some(serial) => (format!("avd:stop:{serial}"), format!("● Stop {pretty}")),
            None => (format!("avd:start:{}", avd.name), format!("○ Launch {pretty}")),
        });
    }

    for sim in crate::sim::list_simulators().unwrap_or_default() {
        items.push(if sim.state == "Booted" {
            (
                format!("sim:stop:{}", sim.udid),
                format!("● Shutdown {}", sim.name),
            )
        } else {
            (
                format!("sim:start:{}", sim.udid),
                format!("○ Boot {}", sim.name),
            )
        });
    }
    items
}

fn on_menu_event<R: Runtime>(app: &AppHandle<R>, id: &str) {
    match id {
        "quit" => app.exit(0),
        "show" => {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
        }
        _ => {
            // Device actions can block for seconds (the emulator shutdown wait),
            // and this handler runs on the main thread — blocking it freezes the
            // menu bar for every app.
            let id = id.to_string();
            let app = app.clone();
            std::thread::spawn(move || {
                let (kind, rest) = id.split_once(':').unwrap_or((&id, ""));
                match kind {
                    "kill" => {
                        if let Ok(pid) = rest.parse() {
                            let _ = crate::ports::kill_process(pid);
                        }
                    }
                    "avd" => match rest.split_once(':') {
                        Some(("stop", serial)) => {
                            let _ = crate::avd::stop_avd(serial.to_string());
                        }
                        Some(("start", name)) => {
                            let _ = crate::avd::launch_avd(name.to_string());
                        }
                        _ => {}
                    },
                    "sim" => match rest.split_once(':') {
                        Some(("stop", udid)) => {
                            let _ = crate::sim::shutdown_simulator(udid.to_string());
                        }
                        Some(("start", udid)) => {
                            let _ = crate::sim::boot_simulator(udid.to_string());
                        }
                        _ => {}
                    },
                    _ => return,
                }
                refresh(&app);
            });
        }
    }
}

/// Rebuild the menu with the current port list. Must run on the main thread
/// (macOS requirement), which `run_on_main_thread` guarantees.
pub fn refresh<R: Runtime>(app: &AppHandle<R>) {
    let app = app.clone();
    let _ = app.clone().run_on_main_thread(move || {
        if let (Some(tray), Ok(menu)) = (app.tray_by_id(TRAY_ID), build_menu(&app)) {
            let _ = tray.set_menu(Some(menu));
        }
    });
}

pub fn init<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    TrayIconBuilder::with_id(TRAY_ID)
        .icon(app.default_window_icon().unwrap().clone())
        .icon_as_template(true) // macOS menu bar: adapt to light/dark
        .menu(&build_menu(app)?)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| on_menu_event(app, event.id.as_ref()))
        .build(app)?;

    // ponytail: poll every 5s instead of subscribing to port changes.
    // Swap for an on-open refresh if the 5s window ever feels stale.
    let app = app.clone();
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_secs(5));
        refresh(&app);
    });
    Ok(())
}
