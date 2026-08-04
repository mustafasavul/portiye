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

    menu.append(&PredefinedMenuItem::separator(app)?)?;
    menu.append(&MenuItem::with_id(app, "show", "Emulators…", true, None::<&str>)?)?;
    menu.append(&MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?)?;
    Ok(menu)
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
            if let Some(pid) = id.strip_prefix("kill:").and_then(|p| p.parse().ok()) {
                let _ = crate::ports::kill_process(pid);
                refresh(app);
            }
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
