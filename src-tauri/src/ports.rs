//! Listening TCP ports + the processes that own them.
//!
//! Strategy: shell out to the platform's own tool to get (pid, port) pairs,
//! then resolve the process *name* with `sysinfo` so the naming is identical
//! on every OS (lsof truncates COMMAND, Windows `netstat` has no name at all).

use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::process::Command;
use sysinfo::{Pid, System};

#[derive(Serialize, Clone, Debug)]
pub struct PortEntry {
    pub pid: u32,
    pub port: u16,
    pub name: String,
    /// Human-meaningful owner: the .app it belongs to, the AVD it runs, or the
    /// project directory it was started from. Empty when nothing is knowable.
    pub detail: String,
    /// Resident set size in bytes (0 when the process vanished mid-scan).
    pub memory: u64,
    /// Percent of one core. Zero on the very first scan — sysinfo needs two
    /// samples of the same `System` to have anything to compare.
    pub cpu: f32,
    /// PID of the highest ancestor that is *also* listening, or this PID when
    /// the process has no listening ancestor. Rows sharing a family belong to
    /// one tree — `emulator` spawning `qemu`, `adb` spawning its server.
    pub family: u32,
}

/// Walk up the process tree and return the topmost ancestor that also holds a
/// listening socket. Falls back to `pid` itself when nothing above it listens.
///
/// `parent_of` only has to cover the ancestry chain, not the whole system.
fn family_root(
    pid: u32,
    parent_of: &HashMap<u32, u32>,
    listeners: &HashSet<u32>,
) -> u32 {
    let mut cur = pid;
    let mut root = pid;
    let mut seen = HashSet::from([pid]);
    loop {
        let Some(&parent) = parent_of.get(&cur) else { break };
        // Stop on 0, self, or a revisit — a cycle must yield one stable answer,
        // not an answer that depends on how many times we went round.
        if parent == 0 || !seen.insert(parent) {
            break;
        }
        if listeners.contains(&parent) {
            root = parent; // keep climbing — we want the *topmost* listener
        }
        cur = parent;
    }
    root
}

/// `$HOME` on unix, `%USERPROFILE%` on Windows.
pub fn home_dir() -> Option<String> {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .ok()
}

/// Turn a raw argv + cwd into something a developer recognises.
///
/// Bare "node" tells you nothing; "portiye" (its cwd) or "Claude" (its bundle)
/// tells you which thing to kill.
fn detail_for(argv: &str, cwd: Option<&str>, home: Option<&str>) -> String {
    // `emulator -avd Medium_Phone` / qemu launched by it
    if let Some(rest) = argv.split(" -avd ").nth(1) {
        if let Some(name) = rest.split_whitespace().next() {
            return format!("AVD {}", name.replace('_', " "));
        }
    }

    // Anything inside a macOS bundle: /Applications/Antigravity IDE.app/... -> "Antigravity IDE"
    if let Some(before) = argv.split(".app/").next() {
        if before.len() < argv.len() {
            if let Some(name) = before.rsplit('/').next() {
                if !name.is_empty() {
                    return name.to_string();
                }
            }
        }
    }

    // Otherwise the working directory is the best "which project is this" signal.
    match cwd {
        Some(dir) if dir != "/" && !dir.is_empty() => match home {
            Some(h) if dir.starts_with(h) => format!("~{}", &dir[h.len()..]),
            _ => dir.to_string(),
        },
        _ => String::new(),
    }
}

/// Build a `Command` that never flashes a console window on Windows.
pub fn cmd(program: impl AsRef<std::ffi::OsStr>) -> Command {
    let c = Command::new(program);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let mut c = c;
        c.creation_flags(CREATE_NO_WINDOW);
        return c;
    }
    #[cfg(not(target_os = "windows"))]
    c
}

/// macOS / Linux: `lsof -nP -iTCP -sTCP:LISTEN`
///
/// ```text
/// COMMAND   PID  USER  FD  TYPE  DEVICE  SIZE/OFF  NODE  NAME
/// node    12345  me    23u IPv6  0x...   0t0       TCP   *:3000 (LISTEN)
/// ```
// Both parsers are always compiled so the tests run on any host.
#[allow(dead_code)]
fn parse_lsof(stdout: &str) -> Vec<(u32, u16)> {
    stdout
        .lines()
        .skip(1) // header
        .filter_map(|line| {
            let cols: Vec<&str> = line.split_whitespace().collect();
            let pid = cols.get(1)?.parse().ok()?;
            // NAME is the column right before "(LISTEN)": "*:3000", "127.0.0.1:5432"
            let addr = cols.iter().rev().find(|c| c.contains(':'))?;
            let port = addr.rsplit(':').next()?.parse().ok()?;
            Some((pid, port))
        })
        .collect()
}

#[allow(dead_code)]
fn parse_netstat(stdout: &str) -> Vec<(u32, u16)> {
    stdout
        .lines()
        .filter(|l| l.contains("LISTENING"))
        .filter_map(|line| {
            let cols: Vec<&str> = line.split_whitespace().collect();
            let pid = cols.last()?.parse().ok()?;
            // Local Address is col 1; IPv6 looks like "[::]:3000" so take after last ':'
            let port = cols.get(1)?.rsplit(':').next()?.parse().ok()?;
            Some((pid, port))
        })
        .collect()
}

#[cfg(unix)]
fn raw_pairs() -> Result<Vec<(u32, u16)>, String> {
    // GUI-launched apps get a minimal PATH, so try the absolute paths first.
    let bin = ["/usr/sbin/lsof", "/usr/bin/lsof"]
        .into_iter()
        .find(|p| std::path::Path::new(p).exists())
        .unwrap_or("lsof");

    let out = cmd(bin)
        .args(["-nP", "-iTCP", "-sTCP:LISTEN"])
        .output()
        .map_err(|e| format!("lsof failed: {e}"))?;

    Ok(parse_lsof(&String::from_utf8_lossy(&out.stdout)))
}

/// Windows: `netstat -ano -p TCP`
///
/// ```text
///   Proto  Local Address      Foreign Address   State      PID
///   TCP    0.0.0.0:3000       0.0.0.0:0         LISTENING  12345
/// ```
#[cfg(windows)]
fn raw_pairs() -> Result<Vec<(u32, u16)>, String> {
    let out = cmd("netstat")
        .args(["-ano", "-p", "TCP"])
        .output()
        .map_err(|e| format!("netstat failed: {e}"))?;

    Ok(parse_netstat(&String::from_utf8_lossy(&out.stdout)))
}

/// The real scan. Takes the caller's `System` so CPU percentages have a
/// previous sample to compare against — a fresh `System` always reports 0.
pub fn scan(sys: &mut System) -> Result<Vec<PortEntry>, String> {
    sys.refresh_all();
    let mut pairs = raw_pairs()?;
    pairs.sort_unstable();
    pairs.dedup();

    let home = home_dir();

    // Ancestry of every listener, walked once up front so `family_root` is a
    // pure lookup rather than a repeated system query.
    let listeners: HashSet<u32> = pairs.iter().map(|(pid, _)| *pid).collect();
    let mut parent_of: HashMap<u32, u32> = HashMap::new();
    for &pid in &listeners {
        let mut cur = pid;
        for _ in 0..64 {
            let Some(parent) = sys
                .process(Pid::from_u32(cur))
                .and_then(|p| p.parent())
                .map(|p| p.as_u32())
            else {
                break;
            };
            if parent == 0 || parent == cur || parent_of.contains_key(&cur) {
                break;
            }
            parent_of.insert(cur, parent);
            cur = parent;
        }
    }

    let mut entries: Vec<PortEntry> = pairs
        .into_iter()
        .map(|(pid, port)| {
            let proc = sys.process(Pid::from_u32(pid));
            let argv = proc
                .map(|p| {
                    p.cmd()
                        .iter()
                        .map(|a| a.to_string_lossy())
                        .collect::<Vec<_>>()
                        .join(" ")
                })
                .unwrap_or_default();
            let cwd = proc
                .and_then(|p| p.cwd())
                .map(|c| c.to_string_lossy().into_owned());
            PortEntry {
                pid,
                port,
                name: proc
                    .map(|p| p.name().to_string_lossy().into_owned())
                    .unwrap_or_else(|| "unknown".into()),
                detail: detail_for(&argv, cwd.as_deref(), home.as_deref()),
                memory: proc.map(|p| p.memory()).unwrap_or(0),
                cpu: proc.map(|p| p.cpu_usage()).unwrap_or(0.0),
                family: family_root(pid, &parent_of, &listeners),
            }
        })
        .collect();

    entries.sort_by_key(|e| e.port);
    Ok(entries)
}


#[derive(Serialize, Default, Debug)]
pub struct KillReport {
    pub killed: Vec<u32>,
    /// Alive, but the OS refused — almost always another user's process.
    pub denied: Vec<u32>,
    /// Already gone by the time we got there. Not an error.
    pub missing: Vec<u32>,
    /// How this platform asks for elevation, so the UI can say it plainly.
    pub elevation: String,
}

fn elevation_hint() -> String {
    if cfg!(target_os = "macos") {
        "macOS will ask for your password.".into()
    } else if cfg!(target_os = "windows") {
        "Windows will show a User Account Control prompt.".into()
    } else {
        "Your desktop will ask for authentication.".into()
    }
}

/// Kill many at once, reporting each outcome rather than failing on the first.
#[tauri::command]
pub fn kill_processes(pids: Vec<u32>) -> KillReport {
    let sys = System::new_all();
    let mut report = KillReport {
        elevation: elevation_hint(),
        ..Default::default()
    };

    for pid in pids {
        match sys.process(Pid::from_u32(pid)) {
            None => report.missing.push(pid),
            Some(proc) if proc.kill() => report.killed.push(pid),
            Some(_) => report.denied.push(pid),
        }
    }
    report
}

/// Retry the refused ones with administrator rights.
///
/// Every platform gets its own native prompt — no password ever passes through
/// this app. The PIDs are `u32`, so the command string they build is digits and
/// spaces only and cannot carry a shell payload.
#[tauri::command]
pub fn kill_processes_elevated(pids: Vec<u32>) -> Result<(), String> {
    if pids.is_empty() {
        return Ok(());
    }
    let list = pids
        .iter()
        .map(u32::to_string)
        .collect::<Vec<_>>()
        .join(" ");

    #[cfg(target_os = "macos")]
    let out = cmd("osascript")
        .args([
            "-e",
            &format!(
                "do shell script \"/bin/kill -9 {list}\" with administrator privileges"
            ),
        ])
        .output();

    #[cfg(target_os = "linux")]
    let out = {
        let mut args = vec!["/bin/kill".to_string(), "-9".to_string()];
        args.extend(pids.iter().map(u32::to_string));
        cmd("pkexec").args(&args).output()
    };

    #[cfg(target_os = "windows")]
    let out = {
        let args = pids
            .iter()
            .map(|p| format!("'/PID','{p}'"))
            .collect::<Vec<_>>()
            .join(",");
        cmd("powershell")
            .args([
                "-NoProfile",
                "-Command",
                &format!(
                    "Start-Process taskkill -ArgumentList '/F',{args} -Verb RunAs -Wait"
                ),
            ])
            .output()
    };

    let out = out.map_err(|e| format!("could not request elevation: {e}"))?;
    if out.status.success() {
        Ok(())
    } else {
        let err = String::from_utf8_lossy(&out.stderr);
        // The user clicking Cancel is not a failure worth shouting about.
        if err.contains("User canceled") || err.contains("dismissed") {
            Ok(())
        } else {
            Err(format!("elevated kill failed: {}", err.trim()))
        }
    }
}

#[tauri::command]
pub fn kill_process(pid: u32) -> Result<(), String> {
    let sys = System::new_all();
    let proc = sys
        .process(Pid::from_u32(pid))
        .ok_or_else(|| format!("no process with pid {pid}"))?;
    // sysinfo sends SIGKILL on unix / TerminateProcess on Windows.
    if proc.kill() {
        Ok(())
    } else {
        Err(format!("could not kill pid {pid} (permission denied?)"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_lsof() {
        let out = "\
COMMAND     PID USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node      12345   me   23u  IPv6 0x1a2b3c4d5e6f7890      0t0  TCP *:3000 (LISTEN)
postgres    987   me    7u  IPv4 0x1a2b3c4d5e6f7891      0t0  TCP 127.0.0.1:5432 (LISTEN)
rapportd    555   me    5u  IPv6 0x1a2b3c4d5e6f7892      0t0  TCP [::1]:49152 (LISTEN)
";
        assert_eq!(
            parse_lsof(out),
            vec![(12345, 3000), (987, 5432), (555, 49152)]
        );
    }

    #[test]
    fn detail_prefers_avd_then_bundle_then_cwd() {
        assert_eq!(
            detail_for("/sdk/emulator/qemu -avd Medium_Phone -no-snapshot", None, None),
            "AVD Medium Phone"
        );
        assert_eq!(
            detail_for("/Applications/Antigravity IDE.app/Contents/MacOS/x", None, None),
            "Antigravity IDE"
        );
        assert_eq!(
            detail_for("node vite", Some("/Users/me/Projects/portiye"), Some("/Users/me")),
            "~/Projects/portiye"
        );
        assert_eq!(detail_for("launchd", Some("/"), None), "");
    }

    #[test]
    fn family_root_climbs_to_the_topmost_listener() {
        // emulator(10) -> qemu(20) -> helper(30); 40 is unrelated.
        // 15 sits between 10 and 20 but listens on nothing.
        let parents = HashMap::from([(30, 20), (20, 15), (15, 10), (10, 1), (40, 1)]);
        let listeners = HashSet::from([10, 20, 30, 40]);

        assert_eq!(family_root(30, &parents, &listeners), 10);
        assert_eq!(family_root(20, &parents, &listeners), 10);
        assert_eq!(family_root(10, &parents, &listeners), 10, "root is its own family");
        assert_eq!(family_root(40, &parents, &listeners), 40, "unrelated stays alone");
    }

    #[test]
    fn family_root_survives_a_parent_cycle() {
        let parents = HashMap::from([(1, 2), (2, 1)]);
        assert_eq!(family_root(1, &parents, &HashSet::from([1, 2])), 2);
    }

    #[test]
    fn kill_processes_reports_each_outcome() {
        // Our own child, so the test never touches anything it does not own.
        let child = Command::new("sleep")
            .arg("60")
            .spawn()
            .expect("spawn a sleep to kill");
        let pid = child.id();
        // PID 1 is init/launchd: alive, and never killable by a normal user.
        let report = kill_processes(vec![pid, 1, 4_294_967_294]);

        assert_eq!(report.killed, vec![pid], "our own child should die");
        assert_eq!(report.denied, vec![1], "pid 1 is alive but protected");
        assert_eq!(
            report.missing,
            vec![4_294_967_294],
            "a pid that does not exist is missing, not denied"
        );
        assert!(!report.elevation.is_empty(), "the UI needs something to say");
    }

    #[test]
    fn parses_netstat() {
        let out = "\
Active Connections

  Proto  Local Address          Foreign Address        State           PID
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       12345
  TCP    127.0.0.1:5432         0.0.0.0:0              LISTENING       987
  TCP    [::]:8080              [::]:0                 LISTENING       42
  TCP    127.0.0.1:9999         127.0.0.1:1234         ESTABLISHED     7
";
        assert_eq!(
            parse_netstat(out),
            vec![(12345, 3000), (987, 5432), (42, 8080)]
        );
    }
}
