//! Native system-tray / menu-bar menu listing the listening ports.
//!
//! Native menu instead of a second webview: no extra window to position, and
//! it looks right on all three platforms for free.
//!
//! The menu is deliberately four items tall. A flat item per listening PID
//! meant a menu bar that unrolled past the bottom of the screen on any machine
//! with a few dev servers up — so ports live in a submenu, grouped into the
//! same process families the window shows, and devices in another.

use std::collections::BTreeMap;

use tauri::menu::{IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, Runtime};

use crate::i18n::t;
use crate::ports::PortEntry;

pub const TRAY_ID: &str = "portiye-tray";

/// Families listed before the menu is truncated. Past this the menu is taller
/// than the screen again, which is the thing this file exists to avoid.
const MAX_FAMILIES: usize = 30;

/// Menu ids are `kill:<pid>` — or `kill:<pid>,<pid>` for a whole family — so
/// the click handler needs no shared state.
fn build_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let menu = Menu::new(app)?;

    // Reads the watcher's last scan — the tray must never run its own.
    let ports = crate::watch::get_listening_ports(app.state::<crate::watch::Watch>());
    if ports.is_empty() {
        menu.append(&MenuItem::with_id(
            app,
            "none",
            t("tray.none"),
            false,
            None::<&str>,
        )?)?;
    } else {
        menu.append(&ports_submenu(app, &ports)?)?;
    }

    // Devices: the other half of the app, reachable without opening the window.
    // Only the ones that can be toggled from here — a stopped simulator needs
    // Simulator.app to come forward anyway, which the boot command handles.
    let devices = device_items();
    if !devices.is_empty() {
        let items = devices
            .into_iter()
            .map(|(id, label)| MenuItem::with_id(app, id, label, true, None::<&str>))
            .collect::<tauri::Result<Vec<_>>>()?;
        menu.append(&submenu(
            app,
            format!("{} ({})", t("tray.devices"), items.len()),
            &items,
        )?)?;
    }

    menu.append(&PredefinedMenuItem::separator(app)?)?;
    menu.append(&MenuItem::with_id(
        app,
        "show",
        t("tray.show"),
        true,
        None::<&str>,
    )?)?;
    menu.append(&MenuItem::with_id(
        app,
        "quit",
        t("tray.quit"),
        true,
        None::<&str>,
    )?)?;
    Ok(menu)
}

/// `Submenu::with_items` wants trait objects; every caller here has a plain
/// `Vec<MenuItem>` or `Vec<Box<dyn IsMenuItem>>`, so the borrow dance happens
/// once, here.
fn submenu<R: Runtime, I: IsMenuItem<R>>(
    app: &AppHandle<R>,
    title: String,
    items: &[I],
) -> tauri::Result<Submenu<R>> {
    let refs: Vec<&dyn IsMenuItem<R>> = items.iter().map(|i| i as &dyn IsMenuItem<R>).collect();
    Submenu::with_items(app, title, true, &refs)
}

/// One process: every port it holds, what it is, and how much it costs.
fn process_label(pid: u32, ports: &[u16], entry: &PortEntry) -> String {
    let list = ports
        .iter()
        .map(|p| format!(":{p}"))
        .collect::<Vec<_>>()
        .join(", ");
    let who = if entry.detail.is_empty() {
        entry.name.clone()
    } else {
        format!("{} · {}", entry.name, entry.detail)
    };
    format!(
        "{list}  {who}  —  {} MB  (pid {pid})",
        entry.memory / 1_048_576
    )
}

/// Ports, grouped the way the window groups them: one entry per process, and
/// a nested submenu whenever a process family holds more than one of them.
fn ports_submenu<R: Runtime>(app: &AppHandle<R>, ports: &[PortEntry]) -> tauri::Result<Submenu<R>> {
    // family -> pid -> its ports. `BTreeMap` so the menu order is stable
    // between rebuilds instead of following hash iteration.
    let mut families: BTreeMap<u32, BTreeMap<u32, (Vec<u16>, &PortEntry)>> = BTreeMap::new();
    for entry in ports {
        families
            .entry(entry.family)
            .or_default()
            .entry(entry.pid)
            .or_insert_with(|| (Vec::new(), entry))
            .0
            .push(entry.port);
    }
    for procs in families.values_mut() {
        for (list, _) in procs.values_mut() {
            list.sort_unstable();
        }
    }

    // Lowest port first — the same reading order as the table, and far more
    // memorable than a PID.
    let mut ordered: Vec<_> = families.into_iter().collect();
    ordered.sort_by_key(|(_, procs)| {
        procs
            .values()
            .flat_map(|(list, _)| list.iter().copied())
            .min()
            .unwrap_or(u16::MAX)
    });
    let hidden = ordered.len().saturating_sub(MAX_FAMILIES);
    ordered.truncate(MAX_FAMILIES);

    let mut items: Vec<Box<dyn IsMenuItem<R>>> = Vec::new();
    for (_, procs) in ordered {
        // A lone process is a lone item: a submenu holding one entry is a
        // click for nothing.
        if procs.len() == 1 {
            let (pid, (list, entry)) = procs.into_iter().next().expect("len == 1");
            items.push(Box::new(MenuItem::with_id(
                app,
                format!("kill:{pid}"),
                process_label(pid, &list, entry),
                true,
                None::<&str>,
            )?));
            continue;
        }

        let mut children: Vec<MenuItem<R>> = Vec::new();
        for (pid, (list, entry)) in &procs {
            children.push(MenuItem::with_id(
                app,
                format!("kill:{pid}"),
                process_label(*pid, list, entry),
                true,
                None::<&str>,
            )?);
        }
        let pids = procs
            .keys()
            .map(|p| p.to_string())
            .collect::<Vec<_>>()
            .join(",");
        children.push(MenuItem::with_id(
            app,
            format!("kill:{pids}"),
            format!("{} ({})", t("tray.killAll"), procs.len()),
            true,
            None::<&str>,
        )?);

        // The root names the family — `emulator` rather than the `qemu` it
        // spawned — and the count says what is folded inside.
        let root = procs.values().next().expect("non-empty");
        let title = format!(
            "{}  ({} × {})",
            root.1.name,
            procs.len(),
            procs.values().map(|(l, _)| l.len()).sum::<usize>()
        );
        items.push(Box::new(submenu(app, title, &children)?));
    }

    if hidden > 0 {
        items.push(Box::new(MenuItem::with_id(
            app,
            "more",
            format!("+{hidden}…"),
            false,
            None::<&str>,
        )?));
    }

    let total = ports.len();
    let refs: Vec<&dyn IsMenuItem<R>> = items.iter().map(|i| i.as_ref()).collect();
    Submenu::with_items(app, format!("{} ({total})", t("tray.ports")), true, &refs)
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
            Some(serial) => (
                format!("avd:stop:{serial}"),
                format!("● {} {pretty}", t("tray.stop")),
            ),
            None => (
                format!("avd:start:{}", avd.name),
                format!("○ {} {pretty}", t("tray.launch")),
            ),
        });
    }

    for sim in crate::sim::list_simulators().unwrap_or_default() {
        items.push(if sim.state == "Booted" {
            (
                format!("sim:stop:{}", sim.udid),
                format!("● {} {}", t("tray.shutdown"), sim.name),
            )
        } else {
            (
                format!("sim:start:{}", sim.udid),
                format!("○ {} {}", t("tray.boot"), sim.name),
            )
        });
    }
    items
}

/// The PIDs a `kill:` menu id targets — one, or a whole family.
fn pids_of(id: &str) -> Vec<u32> {
    id.strip_prefix("kill:")
        .unwrap_or_default()
        .split(',')
        .filter_map(|p| p.parse().ok())
        .collect()
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
                        for pid in pids_of(&id) {
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

    // No polling loop here: the watcher owns the only one and calls `refresh`
    // after every scan. Two loops meant two scans of the same machine.
    Ok(())
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
            assert!(
                matches!(action, "start" | "stop"),
                "unexpected action {action}"
            );
            assert!(!target.is_empty(), "every entry names a target");
            assert!(!label.is_empty(), "every entry has a label");
        }
    }

    #[test]
    fn a_family_kill_id_lists_every_pid_in_it() {
        assert_eq!(pids_of("kill:12"), vec![12]);
        assert_eq!(pids_of("kill:12,7,900"), vec![12, 7, 900]);
        // Garbage in an id must drop out rather than kill pid 0 or panic.
        assert!(pids_of("kill:").is_empty());
        assert_eq!(pids_of("kill:12,junk"), vec![12]);
    }
}
