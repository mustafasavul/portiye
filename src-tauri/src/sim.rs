//! iOS/watchOS/tvOS simulators via `xcrun simctl`.
//!
//! macOS-only in practice; on other platforms `xcrun` simply fails to spawn
//! and we return an empty list instead of an error, so the UI stays quiet.

use serde::Serialize;
use std::process::Command;

#[derive(Serialize, Clone, Debug)]
pub struct Simulator {
    pub udid: String,
    pub name: String,
    pub state: String,   // "Booted" | "Shutdown" | ...
    pub runtime: String, // "iOS 18.0"
}

fn simctl(args: &[&str]) -> Result<Vec<u8>, String> {
    let out = Command::new("xcrun")
        .arg("simctl")
        .args(args)
        .output()
        .map_err(|e| format!("xcrun not found: {e}"))?;
    if out.status.success() {
        Ok(out.stdout)
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

/// "com.apple.CoreSimulator.SimRuntime.iOS-18-0" -> "iOS 18.0"
fn pretty_runtime(key: &str) -> String {
    let tail = key.rsplit('.').next().unwrap_or(key);
    match tail.split_once('-') {
        Some((platform, version)) => format!("{platform} {}", version.replace('-', ".")),
        None => tail.to_string(),
    }
}

#[tauri::command]
pub fn list_simulators() -> Result<Vec<Simulator>, String> {
    // No xcrun (Linux/Windows, or no Xcode) -> just show nothing.
    let Ok(stdout) = simctl(&["list", "devices", "--json"]) else {
        return Ok(vec![]);
    };
    let json: serde_json::Value =
        serde_json::from_slice(&stdout).map_err(|e| format!("bad simctl json: {e}"))?;

    let mut sims: Vec<Simulator> = json["devices"]
        .as_object()
        .into_iter()
        .flatten()
        .flat_map(|(runtime, devices)| {
            let runtime = pretty_runtime(runtime);
            devices
                .as_array()
                .cloned()
                .unwrap_or_default()
                .into_iter()
                // Runtimes that are no longer installed leave ghost devices behind.
                .filter(|d| d["isAvailable"].as_bool().unwrap_or(false))
                .map(move |d| Simulator {
                    udid: d["udid"].as_str().unwrap_or_default().to_string(),
                    name: d["name"].as_str().unwrap_or_default().to_string(),
                    state: d["state"].as_str().unwrap_or("Unknown").to_string(),
                    runtime: runtime.clone(),
                })
        })
        .collect();

    // Booted first, then alphabetical.
    sims.sort_by(|a, b| {
        (a.state != "Booted", &a.runtime, &a.name).cmp(&(b.state != "Booted", &b.runtime, &b.name))
    });
    Ok(sims)
}

#[tauri::command]
pub fn boot_simulator(udid: String) -> Result<(), String> {
    simctl(&["boot", &udid])?;
    // Bring Simulator.app to the front so the booted device is actually visible.
    let _ = Command::new("open").args(["-a", "Simulator"]).spawn();
    Ok(())
}

#[tauri::command]
pub fn shutdown_simulator(udid: String) -> Result<(), String> {
    simctl(&["shutdown", &udid]).map(|_| ())
}

/// Stop then start again, keeping the device's data.
///
/// `simctl shutdown` returns once the device is down, so unlike the Android
/// emulator this needs no wait loop.
#[tauri::command]
pub fn restart_simulator(udid: String) -> Result<(), String> {
    let _ = simctl(&["shutdown", &udid]); // no-op if already off
    boot_simulator(udid)
}

/// Factory reset: wipes apps, data and caches. Device must be shut down first.
#[tauri::command]
pub fn erase_simulator(udid: String) -> Result<(), String> {
    let _ = simctl(&["shutdown", &udid]); // no-op if already off
    simctl(&["erase", &udid]).map(|_| ())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pretty_runtime_names() {
        assert_eq!(
            pretty_runtime("com.apple.CoreSimulator.SimRuntime.iOS-18-0"),
            "iOS 18.0"
        );
        assert_eq!(
            pretty_runtime("com.apple.CoreSimulator.SimRuntime.watchOS-11-2"),
            "watchOS 11.2"
        );
    }
}
