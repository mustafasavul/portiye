//! Whole-machine GPU load.
//!
//! There is no portable source for this, so each platform gets the cheapest
//! one that works without root, and anything unrecognised reports `None`. The
//! gauge is hidden rather than filled with a made-up number — a GPU pinned at
//! a confident 0% is worse than no GPU row at all.

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
