//! Whole-machine GPU load, and per-process GPU load where NVIDIA's tools
//! expose one.
//!
//! There is no portable source for this, so each platform gets the cheapest
//! one that works without root, and anything unrecognised reports `None`. The
//! gauge is hidden rather than filled with a made-up number — a GPU pinned at
//! a confident 0% is worse than no GPU row at all.

use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::process::Stdio;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

/// How often the streamed sampler reports, matching the port poll.
const PMON_INTERVAL: u64 = 5;
/// Beyond this a reading describes a process that has since stopped using the
/// GPU — or a sampler that died. Either way it stops being shown.
const STALE: Duration = Duration::from_secs(16);

/// One process's share of the GPU.
#[derive(Clone, Copy, Debug)]
pub struct GpuProc {
    /// Percent of the GPU's SMs. `None` on the `--query-compute-apps` fallback,
    /// which reports memory and nothing else.
    pub sm: Option<f32>,
    /// Bytes of video memory. 0 when the source did not say.
    pub memory: u64,
    at: Instant,
}

fn table() -> &'static Mutex<HashMap<u32, GpuProc>> {
    static PROCS: OnceLock<Mutex<HashMap<u32, GpuProc>>> = OnceLock::new();
    PROCS.get_or_init(|| Mutex::new(HashMap::new()))
}

/// What one pid is doing to the GPU right now, or `None` when there is no
/// NVIDIA sampler running, the process is not using the GPU, or its last
/// reading has gone stale.
pub fn per_process(pid: u32) -> Option<GpuProc> {
    let procs = table().lock().ok()?;
    procs.get(&pid).copied().filter(|s| s.at.elapsed() < STALE)
}

/// Start the per-process sampler, if this machine has one.
///
/// `nvidia-smi pmon` is the only per-process source NVIDIA gives, and it costs
/// a whole sample interval per invocation — running it on the 5-second port
/// tick would burn a fifth of every tick inside a subprocess, which is exactly
/// the cost that made devices refresh separately. So it is started once and
/// left streaming: one long-lived child that prints a block every interval,
/// read as it arrives. Same shape as the device log reader.
///
/// `pmon` is a Linux subcommand. Where it is missing (Windows, and drivers too
/// old for it) the thread falls back to polling `--query-compute-apps`, which
/// is a fast one-shot and reports video memory but no SM share — that is a
/// column with one number missing, not a fabricated one.
pub fn start_sampler() {
    std::thread::spawn(|| {
        // No NVIDIA tooling: nothing to sample, and nothing to retry either.
        if crate::ports::cmd("nvidia-smi")
            .arg("-L")
            .output()
            .map(|o| !o.status.success())
            .unwrap_or(true)
        {
            return;
        }

        loop {
            if !stream_pmon() {
                poll_compute_apps();
            }
            // The driver can be reloaded under us; come back rather than
            // leaving the column empty for the rest of the session.
            std::thread::sleep(Duration::from_secs(30));
        }
    });
}

/// Read `nvidia-smi pmon` until it exits. Returns false when it never produced
/// a sample — an old driver, or a platform where `pmon` is not a subcommand.
fn stream_pmon() -> bool {
    let Ok(mut child) = crate::ports::cmd("nvidia-smi")
        .args(["pmon", "-d", &PMON_INTERVAL.to_string(), "-s", "um"])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
    else {
        return false;
    };

    let mut produced = false;
    if let Some(out) = child.stdout.take() {
        let mut columns: Vec<String> = Vec::new();
        for line in BufReader::new(out).lines().map_while(Result::ok) {
            // The first `#` line names the columns; their order and count vary
            // with `-s` and with the driver, so they are read, not assumed.
            if let Some(header) = line.strip_prefix('#') {
                let names: Vec<String> = header
                    .split_whitespace()
                    .map(|c| c.to_lowercase())
                    .collect();
                if names.contains(&"pid".to_string()) {
                    columns = names;
                }
                continue;
            }
            if let Some((pid, sample)) = parse_pmon_row(&columns, &line) {
                produced = true;
                record(pid, sample);
            }
        }
    }
    let _ = child.wait();
    produced
}

/// One `pmon` data row against the header its output declared.
///
/// A field that the driver cannot measure prints `-`; that is "unknown", which
/// leaves the number out rather than calling it zero.
fn parse_pmon_row(columns: &[String], line: &str) -> Option<(u32, (Option<f32>, u64))> {
    if columns.is_empty() {
        return None;
    }
    let cells: Vec<&str> = line.split_whitespace().collect();
    let at = |name: &str| {
        columns
            .iter()
            .position(|c| c == name)
            .and_then(|i| cells.get(i))
            .copied()
    };

    let pid = at("pid")?.parse().ok()?;
    let sm = at("sm").and_then(|v| v.parse::<f32>().ok());
    // `fb` is the framebuffer figure, in MiB.
    let memory = at("fb")
        .and_then(|v| v.parse::<u64>().ok())
        .map(|mb| mb * 1_048_576)
        .unwrap_or(0);
    Some((pid, (sm, memory)))
}

/// The fallback: video memory per compute process, no SM share. Fast enough to
/// poll, and it is the number that matters when a model is resident.
fn poll_compute_apps() {
    loop {
        let Ok(out) = crate::ports::cmd("nvidia-smi")
            .args([
                "--query-compute-apps=pid,used_gpu_memory",
                "--format=csv,noheader,nounits",
            ])
            .output()
        else {
            return;
        };
        if !out.status.success() {
            return;
        }
        for (pid, sample) in parse_compute_apps(&String::from_utf8_lossy(&out.stdout)) {
            record(pid, sample);
        }
        std::thread::sleep(Duration::from_secs(PMON_INTERVAL));
    }
}

fn parse_compute_apps(stdout: &str) -> Vec<(u32, (Option<f32>, u64))> {
    stdout
        .lines()
        .filter_map(|line| {
            let (pid, mb) = line.split_once(',')?;
            let pid = pid.trim().parse().ok()?;
            let memory = mb.trim().parse::<u64>().ok()? * 1_048_576;
            Some((pid, (None, memory)))
        })
        .collect()
}

/// Store one reading. Two GPUs report the same pid twice inside one block, so
/// readings landing within a sample of each other add up instead of the second
/// card overwriting the first.
fn record(pid: u32, (sm, memory): (Option<f32>, u64)) {
    let Ok(mut procs) = table().lock() else {
        return;
    };
    let now = Instant::now();
    match procs.get_mut(&pid) {
        // Half an interval: comfortably longer than the gap between two cards'
        // lines in one block, comfortably shorter than the gap between blocks.
        Some(prev) if prev.at.elapsed() < Duration::from_secs(PMON_INTERVAL) / 2 => {
            prev.sm = match (prev.sm, sm) {
                (Some(a), Some(b)) => Some(a + b),
                (a, b) => a.or(b),
            };
            prev.memory += memory;
        }
        _ => {
            procs.insert(
                pid,
                GpuProc {
                    sm,
                    memory,
                    at: now,
                },
            );
        }
    }
    // Readings for processes that have gone quiet are dropped rather than kept
    // forever — this map is only ever as long as the GPU is busy.
    procs.retain(|_, s| s.at.elapsed() < STALE);
}

/// Current GPU utilisation, 0–100. `None` when this machine has no source we
/// can read.
#[cfg(target_os = "macos")]
pub fn usage() -> Option<f32> {
    // ~15ms, and no sudo — `powermetrics` would need one and cost far more.
    let out = crate::ports::cmd("ioreg")
        .args(["-r", "-d", "1", "-w", "0", "-c", "IOAccelerator"])
        .output()
        .ok()?;
    parse_ioreg(&String::from_utf8_lossy(&out.stdout))
}

/// The busiest accelerator wins: a Mac with both integrated and discrete
/// graphics lists both, and the idle one is not the interesting number.
#[cfg(target_os = "macos")]
fn parse_ioreg(text: &str) -> Option<f32> {
    const KEY: &str = "\"Device Utilization %\"=";
    text.match_indices(KEY)
        .filter_map(|(at, _)| {
            let rest = &text[at + KEY.len()..];
            let end = rest
                .find(|c: char| !c.is_ascii_digit())
                .unwrap_or(rest.len());
            rest[..end].parse::<f32>().ok()
        })
        .max_by(f32::total_cmp)
}

#[cfg(target_os = "linux")]
pub fn usage() -> Option<f32> {
    // amdgpu and recent i915 publish this directly — a file read, no subprocess.
    for card in 0..4 {
        let path = format!("/sys/class/drm/card{card}/device/gpu_busy_percent");
        if let Some(v) = std::fs::read_to_string(path)
            .ok()
            .and_then(|s| s.trim().parse::<f32>().ok())
        {
            return Some(v);
        }
    }
    nvidia_smi()
}

#[cfg(target_os = "windows")]
pub fn usage() -> Option<f32> {
    // The generic "GPU Engine" performance counters need aggregating across
    // every engine and process to mean anything, so NVIDIA's own tool is the
    // only reading worth trusting here. Everything else gets no gauge.
    nvidia_smi()
}

/// NVIDIA keeps utilisation behind its own tool on every platform.
#[cfg(any(target_os = "linux", target_os = "windows"))]
fn nvidia_smi() -> Option<f32> {
    let out = crate::ports::cmd("nvidia-smi")
        .args([
            "--query-gpu=utilization.gpu",
            "--format=csv,noheader,nounits",
        ])
        .output()
        .ok()?;
    String::from_utf8_lossy(&out.stdout)
        .lines()
        .next()?
        .trim()
        .parse()
        .ok()
}

/// Anything else — BSD, and whatever else Rust will build for.
#[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
pub fn usage() -> Option<f32> {
    None
}

#[cfg(test)]
mod nvidia_tests {
    use super::*;

    fn header(line: &str) -> Vec<String> {
        line.strip_prefix('#')
            .unwrap()
            .split_whitespace()
            .map(|c| c.to_lowercase())
            .collect()
    }

    /// Column *positions* differ between drivers and between `-s` flags, which
    /// is why the header is parsed rather than assumed.
    #[test]
    fn pmon_rows_are_read_against_their_own_header() {
        let cols = header("# gpu        pid  type     sm    mem    enc    dec     fb   command");
        assert_eq!(
            parse_pmon_row(
                &cols,
                "    0      12345     C      45     12      -      -   4096   python"
            ),
            Some((12345, (Some(45.0), 4096 * 1_048_576)))
        );
    }

    #[test]
    fn a_field_the_driver_cannot_measure_is_unknown_not_zero() {
        let cols = header("# gpu        pid  type     sm    mem    enc    dec     fb   command");
        assert_eq!(
            parse_pmon_row(
                &cols,
                "    0      777       C       -      -      -      -      -   ollama"
            ),
            Some((777, (None, 0))),
            "a dash means nobody can tell you, which is not the same as 0%"
        );
    }

    #[test]
    fn a_row_arriving_before_any_header_is_dropped() {
        assert_eq!(
            parse_pmon_row(&[], "    0   12345   C   45   12   -   -   4096   python"),
            None
        );
    }

    #[test]
    fn compute_apps_is_memory_only() {
        assert_eq!(
            parse_compute_apps("12345, 4096\n777, 128\njunk\n"),
            vec![
                (12345, (None, 4096 * 1_048_576)),
                (777, (None, 128 * 1_048_576))
            ]
        );
    }

    /// Two cards reporting the same pid inside one block add up; the next block
    /// replaces rather than doubling for ever.
    #[test]
    fn two_gpus_in_one_block_add_up() {
        record(4242, (Some(30.0), 1_048_576));
        record(4242, (Some(20.0), 1_048_576));
        let s = per_process(4242).expect("just recorded");
        assert_eq!(s.sm, Some(50.0));
        assert_eq!(s.memory, 2 * 1_048_576);
    }
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::*;

    #[test]
    fn reads_the_busiest_accelerator() {
        let text = r#"
          PerformanceStatistics" = {"Tiler Utilization %"=70,"Device Utilization %"=31,"x"=1}
          PerformanceStatistics" = {"Device Utilization %"=87,"Renderer Utilization %"=2}
        "#;
        assert_eq!(parse_ioreg(text), Some(87.0));
    }

    #[test]
    fn a_machine_that_reports_nothing_gets_no_gauge() {
        assert_eq!(parse_ioreg(""), None);
        assert_eq!(parse_ioreg("\"Device Utilization %\"=junk"), None);
    }

    #[test]
    fn a_value_at_the_very_end_of_the_output_still_parses() {
        // `find` returns None when every remaining char is a digit; falling
        // back to the end of the string is what keeps this from being dropped.
        assert_eq!(parse_ioreg("\"Device Utilization %\"=42"), Some(42.0));
    }
}
