//! Everything about one process, fetched only when its panel is open.
//!
//! The expensive parts (`lsof` per pid) never run on the poll loop — a detail
//! panel is a deliberate act, so it can afford a moment.

use serde::Serialize;
use sysinfo::{Pid, ProcessesToUpdate, System};

#[derive(Serialize, Clone, Debug, Default)]
pub struct Relative {
    pub pid: u32,
    pub name: String,
}

#[derive(Serialize, Clone, Debug, Default)]
pub struct ProcessDetail {
    pub pid: u32,
    pub name: String,
    pub command: String,
    pub cwd: String,
    pub user: String,
    pub memory: u64,
    pub cpu: f32,
    /// Seconds since the process started.
    pub uptime: u64,
    /// Root-to-parent chain, outermost first.
    pub ancestors: Vec<Relative>,
    pub children: Vec<Relative>,
    pub open_files: usize,
    /// A readable sample, not the whole table — a browser holds thousands.
    pub files_sample: Vec<String>,
    pub connections: Vec<String>,
    /// Set when `lsof` is missing or refused; the panel says so rather than
    /// showing an empty list that looks like "no connections".
    pub lsof_error: Option<String>,
}

fn name_of(sys: &System, pid: u32) -> String {
    sys.process(Pid::from_u32(pid))
        .map(|p| p.name().to_string_lossy().into_owned())
        .unwrap_or_else(|| "unknown".into())
}

/// `lsof -p <pid>` split into network connections and plain files.
fn lsof_for(pid: u32) -> Result<(Vec<String>, Vec<String>), String> {
    let bin = ["/usr/sbin/lsof", "/usr/bin/lsof"]
        .into_iter()
        .find(|p| std::path::Path::new(p).exists())
        .unwrap_or("lsof");

    let out = crate::ports::cmd(bin)
        .args(["-nP", "-p", &pid.to_string()])
        .output()
        .map_err(|e| format!("lsof unavailable: {e}"))?;

    let text = String::from_utf8_lossy(&out.stdout);
    let mut files = Vec::new();
    let mut conns = Vec::new();

    for line in text.lines().skip(1) {
        let cols: Vec<&str> = line.split_whitespace().collect();
        // COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME
        let Some(kind) = cols.get(4) else { continue };
        let Some(rest) = line.split_whitespace().nth(8) else {
            continue;
        };
        let name = line[line.find(rest).unwrap_or(0)..].trim().to_string();

        if matches!(*kind, "IPv4" | "IPv6") {
            conns.push(name);
        } else if matches!(*kind, "REG" | "DIR" | "CHR" | "PSXSHM") {
            files.push(name);
        }
    }
    Ok((files, conns))
}

#[tauri::command]
pub fn process_detail(pid: u32) -> Result<ProcessDetail, String> {
    let mut sys = System::new_all();
    // A second sample so cpu_usage is a rate rather than zero.
    std::thread::sleep(sysinfo::MINIMUM_CPU_UPDATE_INTERVAL);
    sys.refresh_processes(ProcessesToUpdate::All, true);

    let proc = sys
        .process(Pid::from_u32(pid))
        .ok_or_else(|| format!("process {pid} is gone"))?;

    // Walk up, then reverse: the panel reads outermost-first, like a path.
    let mut ancestors = Vec::new();
    let mut cur = proc.parent().map(|p| p.as_u32());
    let mut guard = 0;
    while let Some(p) = cur {
        if p == 0 || guard > 32 {
            break;
        }
        ancestors.push(Relative {
            pid: p,
            name: name_of(&sys, p),
        });
        cur = sys
            .process(Pid::from_u32(p))
            .and_then(|x| x.parent())
            .map(|x| x.as_u32());
        guard += 1;
    }
    ancestors.reverse();

    let children: Vec<Relative> = sys
        .processes()
        .values()
        .filter(|p| p.parent().map(|x| x.as_u32()) == Some(pid))
        .map(|p| Relative {
            pid: p.pid().as_u32(),
            name: p.name().to_string_lossy().into_owned(),
        })
        .collect();

    let (files, connections, lsof_error) = match lsof_for(pid) {
        Ok((f, c)) => (f, c, None),
        Err(e) => (Vec::new(), Vec::new(), Some(e)),
    };

    Ok(ProcessDetail {
        pid,
        name: proc.name().to_string_lossy().into_owned(),
        command: proc
            .cmd()
            .iter()
            .map(|a| a.to_string_lossy())
            .collect::<Vec<_>>()
            .join(" "),
        cwd: proc
            .cwd()
            .map(|p| p.to_string_lossy().into_owned())
            .unwrap_or_default(),
        user: proc
            .user_id()
            .and_then(|uid| {
                sysinfo::Users::new_with_refreshed_list()
                    .get_user_by_id(uid)
                    .map(|u| u.name().to_string())
            })
            .unwrap_or_default(),
        memory: proc.memory(),
        cpu: proc.cpu_usage(),
        uptime: proc.run_time(),
        ancestors,
        children,
        open_files: files.len(),
        files_sample: files.into_iter().take(20).collect(),
        connections,
        lsof_error,
    })
}
