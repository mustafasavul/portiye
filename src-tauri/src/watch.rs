//! The single poller.
//!
//! Everything that needs to know "what is listening right now" reads from here
//! instead of scanning for itself: the window, the tray, the history. One scan,
//! one `System` — which is also what makes CPU percentages meaningful, since
//! sysinfo needs two samples of the *same* instance to compare.
//!
//! It runs whether or not a window is open, so the history fills in while
//! portiye sits in the tray.

use crate::ports::PortEntry;
use serde::Serialize;
use std::collections::{HashMap, VecDeque};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use sysinfo::System;
use tauri::{AppHandle, Emitter, Manager, Runtime};

/// How many events to keep. At a few dozen a day this is weeks of history.
const HISTORY_CAP: usize = 500;
/// A reopen within this window counts as a takeover rather than a restart.
const CONFLICT_WINDOW_MS: u64 = 30_000;
const POLL: std::time::Duration = std::time::Duration::from_secs(5);

#[derive(Serialize, Clone, Debug)]
pub struct PortEvent {
    /// Milliseconds since the epoch — the UI owns formatting and timezones.
    pub at: u64,
    pub kind: &'static str, // "opened" | "closed" | "taken"
    pub port: u16,
    pub pid: u32,
    pub name: String,
    pub detail: String,
    /// For "taken": who was holding the port before.
    pub previous: Option<String>,
}

#[derive(Default)]
struct Inner {
    ports: Vec<PortEntry>,
    history: VecDeque<PortEvent>,
    /// port -> (when it closed, who held it) — the raw material for takeovers.
    recently_closed: HashMap<u16, (u64, String)>,
    /// Measured once per tick. Both the window and the tray read this copy —
    /// probing the GPU twice per poll would be the two-pollers mistake again,
    /// in miniature.
    stats: SystemStats,
}

pub struct Watch {
    system: Mutex<System>,
    inner: Mutex<Inner>,
}

impl Watch {
    pub fn new() -> Self {
        Self {
            system: Mutex::new(System::new_all()),
            inner: Mutex::new(Inner::default()),
        }
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Diff two scans into events. Pure, so the interesting part is testable
/// without a running system.
fn diff(
    prev: &[PortEntry],
    next: &[PortEntry],
    recently_closed: &mut HashMap<u16, (u64, String)>,
    at: u64,
) -> Vec<PortEvent> {
    let key = |e: &PortEntry| (e.pid, e.port);
    let before: HashMap<(u32, u16), &PortEntry> = prev.iter().map(|e| (key(e), e)).collect();
    let after: HashMap<(u32, u16), &PortEntry> = next.iter().map(|e| (key(e), e)).collect();

    let mut events = Vec::new();

    for (k, e) in &before {
        if !after.contains_key(k) {
            recently_closed.insert(e.port, (at, e.name.clone()));
            events.push(PortEvent {
                at,
                kind: "closed",
                port: e.port,
                pid: e.pid,
                name: e.name.clone(),
                detail: e.detail.clone(),
                previous: None,
            });
        }
    }

    for (k, e) in &after {
        if before.contains_key(k) {
            continue;
        }
        // A takeover: the port was released moments ago by someone else, and a
        // different process now holds it. A process restarting on its own port
        // is the common case and must not be reported as a conflict.
        let taken = recently_closed
            .get(&e.port)
            .filter(|(when, who)| at.saturating_sub(*when) <= CONFLICT_WINDOW_MS && *who != e.name)
            .map(|(_, who)| who.clone());

        events.push(PortEvent {
            at,
            kind: if taken.is_some() { "taken" } else { "opened" },
            port: e.port,
            pid: e.pid,
            name: e.name.clone(),
            detail: e.detail.clone(),
            previous: taken,
        });
    }

    recently_closed.retain(|_, (when, _)| at.saturating_sub(*when) <= CONFLICT_WINDOW_MS);
    events.sort_by_key(|e| e.port);
    events
}

/// One poll: scan, diff, record, publish.
fn tick<R: Runtime>(app: &AppHandle<R>) {
    let watch = app.state::<Watch>();

    let (scanned, stats) = {
        let mut sys = watch.system.lock().unwrap();
        match crate::ports::scan(&mut sys) {
            // Measured under the same lock and the same refresh as the scan,
            // so the numbers the window shows describe the ports beside them.
            Ok(v) => (v, measure(&sys)),
            // A transient lsof failure should not kill the loop.
            Err(_) => return,
        }
    };

    let at = now_ms();

    {
        let mut inner = watch.inner.lock().unwrap();
        inner.stats = stats;
        // Move the previous scan out so `diff` can borrow the close-times map
        // mutably at the same time.
        let prev = std::mem::take(&mut inner.ports);
        let first_run = prev.is_empty() && inner.history.is_empty();

        let events = diff(&prev, &scanned, &mut inner.recently_closed, at);
        // The first scan would otherwise report every existing port as newly
        // opened, which is noise rather than history.
        if !first_run {
            for e in events {
                inner.history.push_front(e);
            }
            while inner.history.len() > HISTORY_CAP {
                inner.history.pop_back();
            }
        }

        inner.ports = scanned;
    }

    let _ = app.emit("ports-changed", ());
    crate::tray::refresh(app);
}

pub fn start<R: Runtime>(app: &AppHandle<R>) {
    let app = app.clone();
    std::thread::spawn(move || loop {
        tick(&app);
        std::thread::sleep(POLL);
    });
}

// ——— Commands ———————————————————————————————————————————

/// Reads the last scan. The frontend no longer polls; it listens for
/// `ports-changed` and calls this.
#[tauri::command]
pub fn get_listening_ports(watch: tauri::State<Watch>) -> Vec<PortEntry> {
    watch.inner.lock().unwrap().ports.clone()
}

#[tauri::command]
pub fn get_port_history(watch: tauri::State<Watch>) -> Vec<PortEvent> {
    watch
        .inner
        .lock()
        .unwrap()
        .history
        .iter()
        .cloned()
        .collect()
}

#[tauri::command]
pub fn clear_port_history(watch: tauri::State<Watch>) {
    watch.inner.lock().unwrap().history.clear();
}

#[derive(Serialize, Clone, Debug, Default)]
pub struct SystemStats {
    /// Whole-machine CPU load, 0–100. Meaningful only because this reads the
    /// poller's own `System` — a fresh instance always reports zero.
    pub cpu: f32,
    /// 0–100, or `None` on a machine with no readable GPU counter.
    pub gpu: Option<f32>,
    /// Bytes.
    pub memory_total: u64,
    /// Bytes.
    pub memory_used: u64,
    /// Bytes. Zero when no usable volume was found.
    pub disk_total: u64,
    /// Bytes.
    pub disk_used: u64,
    /// Which volume the disk numbers describe, e.g. "/" or "C:\\".
    pub disk_name: String,
}

/// The volume worth showing: the biggest fixed one. macOS splits the boot
/// container across `/` and `/System/Volumes/Data` and both report the same
/// total, Linux lands on `/`, Windows on `C:` — one rule, no `#[cfg]`.
///
/// Takes `(total_space, is_removable)` rather than the disks themselves so the
/// rule can be tested without a real filesystem.
fn primary_index(disks: impl IntoIterator<Item = (u64, bool)>) -> Option<usize> {
    disks
        .into_iter()
        .enumerate()
        .filter(|(_, (total, removable))| !removable && *total > 0)
        .max_by_key(|(_, (total, _))| *total)
        .map(|(i, _)| i)
}

/// Measure host load. Called once per tick, never per reader.
fn measure(sys: &System) -> SystemStats {
    // NOT `used_memory()`. On macOS that is `total - free`, and macOS keeps
    // almost nothing free — it lends the rest out as cache — so the figure
    // sits pinned near the total and barely moves: 13.5 of 16 GB on an idle
    // machine, which reads as a permanent 85%. `total - available` counts
    // reclaimable cache as free, which is both the honest answer to "how much
    // room is left" and a number that actually moves.
    let memory_total = sys.total_memory();
    let memory_used = memory_total.saturating_sub(sys.available_memory());

    // Disks are not part of the port scan, so they are enumerated here — a
    // statfs per mount, unlike the `simctl`/`docker` subprocesses that had to
    // be moved off this tick.
    let disks = sysinfo::Disks::new_with_refreshed_list();
    let list = disks.list();
    let chosen = primary_index(list.iter().map(|d| (d.total_space(), d.is_removable())));
    let (disk_total, disk_used, disk_name) = match chosen.and_then(|i| list.get(i)) {
        Some(d) => (
            d.total_space(),
            d.total_space().saturating_sub(d.available_space()),
            d.mount_point().to_string_lossy().into_owned(),
        ),
        None => (0, 0, String::new()),
    };

    SystemStats {
        cpu: sys.global_cpu_usage(),
        gpu: crate::gpu::usage(),
        memory_total,
        memory_used,
        disk_total,
        disk_used,
        disk_name,
    }
}

/// Host-wide CPU, GPU, RAM and disk, as of the last tick.
#[tauri::command]
pub fn get_system_stats(watch: tauri::State<Watch>) -> SystemStats {
    watch.inner.lock().unwrap().stats.clone()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(pid: u32, port: u16, name: &str) -> PortEntry {
        PortEntry {
            pid,
            port,
            name: name.into(),
            detail: String::new(),
            memory: 0,
            cpu: 0.0,
            family: pid,
        }
    }

    #[test]
    fn the_primary_disk_is_the_biggest_fixed_one() {
        // A big external drive must not displace the boot volume, and a
        // zero-sized pseudo-mount must not win by default.
        let disks = [(500, false), (2_000, true), (900, false), (0, false)];
        assert_eq!(primary_index(disks), Some(2));
        assert_eq!(primary_index([(1_000, true)]), None, "removable only");
        assert_eq!(primary_index([]), None);
    }

    #[test]
    fn reports_opened_and_closed() {
        let mut closed = HashMap::new();
        let events = diff(
            &[entry(1, 3000, "node")],
            &[entry(2, 5432, "postgres")],
            &mut closed,
            1_000,
        );
        let kinds: Vec<_> = events.iter().map(|e| (e.kind, e.port)).collect();
        assert!(kinds.contains(&("closed", 3000)));
        assert!(kinds.contains(&("opened", 5432)));
    }

    #[test]
    fn a_process_restarting_on_its_own_port_is_not_a_takeover() {
        let mut closed = HashMap::new();
        diff(&[entry(1, 3000, "node")], &[], &mut closed, 1_000);
        // Same name, new pid, moments later — this is just a dev server restart.
        let events = diff(&[], &[entry(9, 3000, "node")], &mut closed, 2_000);
        assert_eq!(events[0].kind, "opened", "a restart must not cry conflict");
        assert!(events[0].previous.is_none());
    }

    #[test]
    fn a_different_process_grabbing_the_port_is_a_takeover() {
        let mut closed = HashMap::new();
        diff(&[entry(1, 3000, "node")], &[], &mut closed, 1_000);
        let events = diff(&[], &[entry(9, 3000, "python")], &mut closed, 2_000);
        assert_eq!(events[0].kind, "taken");
        assert_eq!(events[0].previous.as_deref(), Some("node"));
    }

    #[test]
    fn a_reopen_long_after_the_close_is_just_an_open() {
        let mut closed = HashMap::new();
        diff(&[entry(1, 3000, "node")], &[], &mut closed, 1_000);
        let late = 1_000 + CONFLICT_WINDOW_MS + 1;
        let events = diff(&[], &[entry(9, 3000, "python")], &mut closed, late);
        assert_eq!(events[0].kind, "opened", "stale closes must expire");
        assert!(closed.is_empty(), "and be pruned");
    }
}
