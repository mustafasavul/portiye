//! Android emulator (AVD) listing, launching and stopping.
//!
//! `emulator -list-avds` only knows what *exists*; which ones are *running*
//! comes from `adb devices`, so the two have to be joined by AVD name.

use serde::Serialize;
use std::path::PathBuf;
use std::process::Stdio;

#[derive(Serialize, Clone, Debug)]
pub struct Avd {
    pub name: String,
    /// `emulator-5554` when running, `None` when stopped.
    pub serial: Option<String>,
}

/// Root of the Android SDK. A GUI-launched app does not inherit the shell's
/// PATH or env, so guess the standard layout before trusting either.
fn sdk_root() -> Option<PathBuf> {
    if let Some(p) = std::env::var_os("ANDROID_HOME").or_else(|| std::env::var_os("ANDROID_SDK_ROOT"))
    {
        return Some(PathBuf::from(p));
    }
    let home = PathBuf::from(std::env::var_os("HOME").or_else(|| std::env::var_os("USERPROFILE"))?);
    Some(match () {
        _ if cfg!(target_os = "macos") => home.join("Library/Android/sdk"),
        _ if cfg!(windows) => home.join("AppData/Local/Android/Sdk"),
        _ => home.join("Android/Sdk"),
    })
}

/// `sdk_tool("emulator", "emulator")` -> <sdk>/emulator/emulator, else bare name for PATH.
fn sdk_tool(dir: &str, name: &str) -> PathBuf {
    let exe = if cfg!(windows) {
        format!("{name}.exe")
    } else {
        name.to_string()
    };
    match sdk_root().map(|s| s.join(dir).join(&exe)) {
        Some(p) if p.exists() => p,
        _ => PathBuf::from(exe),
    }
}

fn adb(args: &[&str]) -> Result<String, String> {
    let out = crate::ports::cmd(sdk_tool("platform-tools", "adb"))
        .args(args)
        .output()
        .map_err(|e| format!("adb not found: {e}"))?;
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

/// serial -> AVD name for every booted emulator.
///
/// `adb devices` lists serials only, so each one is asked its own AVD name via
/// the emulator console (`adb -s <serial> emu avd name`).
fn running_serials() -> Vec<(String, String)> {
    let Ok(list) = adb(&["devices"]) else {
        return vec![];
    };
    list.lines()
        .filter_map(|l| l.split_once('\t'))
        .filter(|(serial, state)| serial.starts_with("emulator-") && state.trim() == "device")
        .filter_map(|(serial, _)| {
            // Replies with the AVD name on the first line, then "OK".
            let name = adb(&["-s", serial, "emu", "avd", "name"]).ok()?;
            let name = name.lines().next()?.trim().to_string();
            (!name.is_empty()).then(|| (serial.to_string(), name))
        })
        .collect()
}

#[tauri::command]
pub fn list_avds() -> Result<Vec<Avd>, String> {
    let out = crate::ports::cmd(sdk_tool("emulator", "emulator"))
        .arg("-list-avds")
        .output()
        .map_err(|e| format!("emulator not found: {e}"))?;

    let running = running_serials();

    Ok(String::from_utf8_lossy(&out.stdout)
        .lines()
        .map(str::trim)
        // `emulator -list-avds` can prepend INFO/WARNING noise on stdout.
        .filter(|l| !l.is_empty() && !l.contains(' '))
        .map(|name| Avd {
            name: name.to_string(),
            serial: running
                .iter()
                .find(|(_, n)| n == name)
                .map(|(s, _)| s.clone()),
        })
        .collect())
}

fn spawn_emulator(name: &str, extra: &[&str]) -> Result<(), String> {
    // `ports::cmd` so Windows does not flash a console window on launch.
    let mut c = crate::ports::cmd(sdk_tool("emulator", "emulator"));
    c.args(["-avd", name])
        .args(extra)
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    c.spawn() // detached: we never wait on it
        .map(|_| ())
        .map_err(|e| format!("failed to launch {name}: {e}"))
}

#[tauri::command]
pub fn launch_avd(name: String) -> Result<(), String> {
    spawn_emulator(&name, &[])
}

#[tauri::command]
pub fn stop_avd(serial: String) -> Result<(), String> {
    adb(&["-s", &serial, "emu", "kill"]).map(|_| ())
}

/// Factory reset, the `simctl erase` equivalent: `-wipe-data` throws away
/// userdata and snapshots on the next cold boot.
///
/// The emulator refuses to run the same AVD twice, so a running instance has
/// to be killed *and observed to be gone* before relaunching.
#[tauri::command]
pub fn wipe_avd(name: String, serial: Option<String>) -> Result<(), String> {
    if let Some(serial) = serial {
        adb(&["-s", &serial, "emu", "kill"])?;
        // ponytail: poll instead of watching adb events; 10s covers a normal
        // shutdown, and failing loudly beats a silent "two instances" error.
        let gone = (0..40).any(|_| {
            std::thread::sleep(std::time::Duration::from_millis(250));
            !running_serials().iter().any(|(s, _)| *s == serial)
        });
        if !gone {
            return Err(format!("{serial} did not shut down in time"));
        }
    }
    spawn_emulator(&name, &["-wipe-data"])
}
