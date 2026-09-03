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
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use tauri::menu::{IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, Runtime};

use crate::i18n::t;
use crate::ports::PortEntry;

pub const TRAY_ID: &str = "portiye-tray";

/// Families listed before the menu is truncated. Past this the menu is taller
/// than the screen again, which is the thing this file exists to avoid.
const MAX_FAMILIES: usize = 30;

/// How often the device rows are re-scanned. The same 30 seconds the window
/// uses, and for the same reason: `simctl list` costs ~0.8s.
const DEVICE_POLL: Duration = Duration::from_secs(30);

/// The device rows, scanned on a thread of their own.
///
/// This used to be scanned inside `build_menu`, which runs on the main thread
/// every five seconds — so every five seconds the menu bar froze for the ~0.8s
/// `simctl list` takes, plus `adb`. The window moved device enumeration off the
/// port tick long ago; the tray was still doing it, and on the one thread that
/// must never block.
static DEVICES: Mutex<Vec<(String, String)>> = Mutex::new(Vec::new());

/// What the menu is allowed to draw, and whether it exists at all.
///
/// The window owns these — they live in its storage and are pushed here on
/// every start. Off means the section is not built: a hidden ports submenu
/// costs no grouping pass, and a hidden tray icon costs nothing at all.
static VISIBLE: AtomicBool = AtomicBool::new(true);
static SHOW_STATS: AtomicBool = AtomicBool::new(true);
static SHOW_PORTS: AtomicBool = AtomicBool::new(true);
static SHOW_DEVICES: AtomicBool = AtomicBool::new(true);

/// Whether the tray icon is on screen. The window asks before it decides what
/// closing means: with no icon left, hiding the window would strand the app
/// with no way back to it.
pub fn tray_visible() -> bool {
    VISIBLE.load(Ordering::Relaxed)
}

#[tauri::command]
pub fn set_tray_options<R: Runtime>(
    app: AppHandle<R>,
    visible: bool,
    stats: bool,
    ports: bool,
    devices: bool,
) {
    VISIBLE.store(visible, Ordering::Relaxed);
    SHOW_STATS.store(stats, Ordering::Relaxed);
    SHOW_PORTS.store(ports, Ordering::Relaxed);
    SHOW_DEVICES.store(devices, Ordering::Relaxed);
    // Off, the cached rows are dropped rather than kept warm for a section
    // that is no longer drawn; on, they are scanned without waiting a round.
    std::thread::spawn(move || {
        rescan_devices(&app);
        refresh(&app);
    });
}

/// Menu ids are `kill:<pid>` — or `kill:<pid>,<pid>` for a whole family — so
/// the click handler needs no shared state.
fn build_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let menu = Menu::new(app)?;

    // One glance line of host load, disabled so it reads as a readout rather
    // than something to click.
    if SHOW_STATS.load(Ordering::Relaxed) {
        let stats = crate::watch::get_system_stats(app.state::<crate::watch::Watch>());
        menu.append(&MenuItem::with_id(
            app,
            "stats",
            stats_line(&stats),
            false,
            None::<&str>,
        )?)?;
        menu.append(&PredefinedMenuItem::separator(app)?)?;
    }

    // Reads the watcher's last scan — the tray must never run its own.
    if SHOW_PORTS.load(Ordering::Relaxed) {
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
    }

    // Devices: the other half of the app, reachable without opening the window.
    // Only the ones that can be toggled from here — a stopped simulator needs
    // Simulator.app to come forward anyway, which the boot command handles.
    //
    // A cached read. The scan happens on `scan_devices`'s own thread; nothing
    // here spawns a subprocess, because everything here runs on the main one.
    let devices = DEVICES.lock().map(|d| d.clone()).unwrap_or_default();
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

/// The one-line readout at the top of the menu.
///
/// Whatever this machine cannot measure is left out rather than shown as a
/// confident zero: no readable GPU counter, no `GPU` segment; no fixed volume,
/// no `DISK` segment.
///
/// ponytail: the four labels are borrowed acronyms in every language the app
/// ships, so this needs no entry in `i18n.rs` — and the tray's dictionary is
/// hand-written across 28 locales with no native review beyond two of them.
/// The window beside it already spells the words out in full.
fn stats_line(s: &crate::watch::SystemStats) -> String {
    let pct = |used: u64, total: u64| {
        if total == 0 {
            0
        } else {
            (used as f64 / total as f64 * 100.0).round() as u32
        }
    };

    let mut parts = vec![format!("CPU {}%", s.cpu.round() as u32)];
    if let Some(gpu) = s.gpu {
        parts.push(format!("GPU {}%", gpu.round() as u32));
    }
    parts.push(format!("RAM {}%", pct(s.memory_used, s.memory_total)));
    if s.disk_total > 0 {
        parts.push(format!("DISK {}%", pct(s.disk_used, s.disk_total)));
    }
    parts.join("  ·  ")
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
                    // One call, not one per pid: each `kill_process` builds its
                    // own `System`, so a five-process family paid for five
                    // full scans of the machine.
                    "kill" => {
                        crate::ports::kill_processes(pids_of(&id));
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
                // Straight to the scan: waiting for the next 30-second round
                // would leave the menu saying "Launch" for a booted device.
                rescan_devices(&app);
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
        let Some(tray) = app.tray_by_id(TRAY_ID) else {
            return;
        };
        let visible = tray_visible();
        let _ = tray.set_visible(visible);
        // A menu nobody can open is a menu not worth building — and building
        // it would walk the device listers every five seconds for nothing.
        if visible {
            if let Ok(menu) = build_menu(&app) {
                let _ = tray.set_menu(Some(menu));
            }
        }
    });
}

/// Re-scan the devices into the cache and redraw if they moved. Runs off the
/// main thread — it shells out to `emulator`, `adb` and `simctl`.
fn rescan_devices<R: Runtime>(app: &AppHandle<R>) {
    let wanted = tray_visible() && SHOW_DEVICES.load(Ordering::Relaxed);
    let next = if wanted { device_items() } else { Vec::new() };
    let Ok(mut cache) = DEVICES.lock() else {
        return;
    };
    if *cache == next {
        return;
    }
    *cache = next;
    drop(cache);
    refresh(app);
}

pub fn init<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    // Its own thread, on its own cadence. `refresh` is called every port tick
    // and must stay a menu rebuild, not a round of subprocesses.
    let scanner = app.clone();
    std::thread::spawn(move || loop {
        rescan_devices(&scanner);
        std::thread::sleep(DEVICE_POLL);
    });

    // A dedicated monochrome mark, not the window icon: `icon_as_template`
    // keeps only the alpha channel, so the app icon's plate would flatten into
    // a filled square in the menu bar. This one is the glyph alone, which is
    // what macOS tints for light and dark.
    let tray_icon = tauri::image::Image::from_bytes(include_bytes!("../icons/tray.png"))?;

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(tray_icon)
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

    #[test]
    fn the_readout_omits_what_the_machine_cannot_measure() {
        let full = crate::watch::SystemStats {
            cpu: 45.4,
            gpu: Some(0.0),
            memory_total: 16,
            memory_used: 9,
            disk_total: 100,
            disk_used: 96,
            disk_name: "/".into(),
        };
        assert_eq!(
            stats_line(&full),
            "CPU 45%  ·  GPU 0%  ·  RAM 56%  ·  DISK 96%"
        );

        // No GPU counter and no fixed volume: those segments vanish rather
        // than reporting a confident zero.
        let bare = crate::watch::SystemStats {
            gpu: None,
            disk_total: 0,
            disk_used: 0,
            ..full
        };
        assert_eq!(stats_line(&bare), "CPU 45%  ·  RAM 56%");
    }

    #[test]
    fn a_machine_that_reports_no_memory_does_not_divide_by_zero() {
        assert_eq!(
            stats_line(&crate::watch::SystemStats::default()),
            "CPU 0%  ·  RAM 0%"
        );
    }

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
