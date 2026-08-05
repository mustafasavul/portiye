//! Development runtimes that share the emulator's shape: a thing you can
//! list, see the running state of, start or stop, and sometimes destroy.
//!
//! Every provider returns an empty list when its tool is missing, so a machine
//! without Docker simply shows no Docker rows — never an error. Providers are
//! deliberately limited to tools that exist on macOS, Linux and Windows alike;
//! `brew services` and `systemctl` are single-platform and stay out.
//!
//! Deliberately NOT here: SDK version lists (Java, .NET, Python). A toolchain
//! is not a process — there is nothing to start or stop, so a panel would only
//! restate what `java -version` already says.

use serde::Serialize;
use std::path::PathBuf;
use sysinfo::System;

#[derive(Serialize, Clone, Debug)]
pub struct Runtime {
    /// `<provider>:<native id>` — the action command dispatches on the prefix.
    pub id: String,
    /// Grouping label: "Docker", "Ollama", "JVM".
    pub kind: String,
    pub name: String,
    /// One identifying line: image, size, project path.
    pub meta: String,
    pub running: bool,
    pub can_start: bool,
    pub can_stop: bool,
    /// Irreversible; the UI confirms before calling it.
    pub can_remove: bool,
}

/// First existing path, else the bare name so PATH still gets a chance.
/// GUI-launched apps inherit a minimal PATH, hence the explicit candidates.
fn tool(name: &str, candidates: &[&str]) -> PathBuf {
    candidates
        .iter()
        .map(PathBuf::from)
        .find(|p| p.exists())
        .unwrap_or_else(|| PathBuf::from(name))
}

fn docker_bin() -> PathBuf {
    tool(
        "docker",
        &[
            "/usr/local/bin/docker",
            "/opt/homebrew/bin/docker",
            "/Applications/Docker.app/Contents/Resources/bin/docker",
            "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe",
        ],
    )
}

fn ollama_bin() -> PathBuf {
    tool(
        "ollama",
        &[
            "/usr/local/bin/ollama",
            "/opt/homebrew/bin/ollama",
            "C:\\Program Files\\Ollama\\ollama.exe",
        ],
    )
}

/// Runs a tool and returns stdout, or `None` when it is absent or failed.
/// A missing tool is not an error here — it means "this machine has none".
fn output(bin: PathBuf, args: &[&str]) -> Option<String> {
    let out = crate::ports::cmd(bin).args(args).output().ok()?;
    out.status
        .success()
        .then(|| String::from_utf8_lossy(&out.stdout).into_owned())
}

// ——— Docker ————————————————————————————————————————————————

/// `docker ps -a --format json` emits one JSON object per line.
fn parse_docker(stdout: &str) -> Vec<Runtime> {
    stdout
        .lines()
        .filter_map(|line| serde_json::from_str::<serde_json::Value>(line).ok())
        .filter_map(|c| {
            let id = c["ID"].as_str()?;
            let name = c["Names"].as_str().unwrap_or(id);
            let image = c["Image"].as_str().unwrap_or("");
            let ports = c["Ports"].as_str().unwrap_or("");
            // "running" | "exited" | "created" | "paused" | ...
            let running = c["State"].as_str() == Some("running");

            // image · compose-project · :ports — whichever of the three exist.
            let mut meta = vec![image.to_string()];
            if let Some(project) = compose_project(c["Labels"].as_str().unwrap_or("")) {
                meta.push(project);
            }
            if !ports.is_empty() {
                meta.push(published_ports(ports));
            }

            Some(Runtime {
                id: format!("docker:{id}"),
                kind: "Docker".into(),
                name: name.into(),
                meta: meta.join(" · "),
                running,
                can_start: !running,
                can_stop: running,
                can_remove: true,
            })
        })
        .collect()
}

/// Containers started by the same `docker compose` file carry a shared
/// `com.docker.compose.project` label — the container equivalent of a process
/// family. Naming it turns three loose rows into one recognisable stack.
///
/// The label string is comma-separated `k=v`; values may themselves contain
/// `=` (URLs, hashes), so only the first `=` splits.
fn compose_project(labels: &str) -> Option<String> {
    labels
        .split(',')
        .filter_map(|kv| kv.split_once('='))
        .find(|(k, _)| k.trim() == "com.docker.compose.project")
        .map(|(_, v)| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

/// "0.0.0.0:5432->5432/tcp, :::5432->5432/tcp" -> ":5432"
///
/// Docker repeats every mapping once per address family; only the container's
/// published host port is interesting, and only once.
fn published_ports(ports: &str) -> String {
    let mut seen: Vec<&str> = Vec::new();
    for mapping in ports.split(',') {
        let Some((host, _)) = mapping.split_once("->") else {
            continue;
        };
        let Some(port) = host.trim().rsplit(':').next() else {
            continue;
        };
        if !port.is_empty() && !seen.contains(&port) {
            seen.push(port);
        }
    }
    seen.iter()
        .map(|p| format!(":{p}"))
        .collect::<Vec<_>>()
        .join(" ")
}

fn docker() -> Vec<Runtime> {
    // Daemon down -> non-zero exit -> None -> no rows, no error.
    output(docker_bin(), &["ps", "-a", "--format", "json"])
        .map(|s| parse_docker(&s))
        .unwrap_or_default()
}

// ——— Ollama ————————————————————————————————————————————————

/// `ollama list` is a padded table:
///
/// ```text
/// NAME              ID            SIZE      MODIFIED
/// llama3.1:8b       42182419e950  4.7 GB    2 weeks ago
/// ```
fn parse_ollama_list(stdout: &str) -> Vec<(String, String)> {
    stdout
        .lines()
        .skip(1) // header
        .filter_map(|line| {
            let cols: Vec<&str> = line.split_whitespace().collect();
            // NAME ID SIZE UNIT ...
            match cols.as_slice() {
                [name, _id, size, unit, ..] => {
                    Some((name.to_string(), format!("{size} {unit}")))
                }
                _ => None,
            }
        })
        .collect()
}

/// `ollama ps` has the same shape and lists only the loaded models.
fn parse_ollama_ps(stdout: &str) -> Vec<String> {
    stdout
        .lines()
        .skip(1)
        .filter_map(|l| l.split_whitespace().next().map(str::to_string))
        .collect()
}

fn ollama() -> Vec<Runtime> {
    let Some(list) = output(ollama_bin(), &["list"]) else {
        return vec![];
    };
    let loaded = output(ollama_bin(), &["ps"])
        .map(|s| parse_ollama_ps(&s))
        .unwrap_or_default();

    parse_ollama_list(&list)
        .into_iter()
        .map(|(name, size)| {
            let running = loaded.contains(&name);
            Runtime {
                id: format!("ollama:{name}"),
                kind: "Ollama".into(),
                name,
                meta: if running {
                    format!("{size} · loaded")
                } else {
                    size
                },
                running,
                // `ollama run` wants a prompt and a TTY; loading is the client's
                // job, so the panel only offers to unload.
                can_start: false,
                can_stop: running,
                // Deleting a multi-gigabyte model is not a thing to expose
                // behind a one-click button next to "Stop".
                can_remove: false,
            }
        })
        .collect()
}

// ——— JVM build daemons —————————————————————————————————————

/// Gradle and Kotlin daemons survive the build that spawned them and routinely
/// hold gigabytes. They need no CLI to find — they are just processes — which
/// is what makes this provider work on every platform.
fn jvm_daemons() -> Vec<Runtime> {
    let sys = System::new_all();
    sys.processes()
        .values()
        .filter_map(|p| {
            let argv = p
                .cmd()
                .iter()
                .map(|a| a.to_string_lossy())
                .collect::<Vec<_>>()
                .join(" ");

            let name = if argv.contains("KotlinCompileDaemon") {
                "Kotlin compile daemon"
            } else if argv.contains("GradleDaemon") || argv.contains("gradle.launcher.daemon") {
                "Gradle daemon"
            } else {
                return None;
            };

            let pid = p.pid().as_u32();
            Some(Runtime {
                id: format!("jvm:{pid}"),
                kind: "JVM".into(),
                name: name.into(),
                meta: format!("{} MB · pid {pid}", p.memory() / 1_048_576),
                running: true,
                can_start: false,
                can_stop: true,
                can_remove: false,
            })
        })
        .collect()
}

// ——— Commands ——————————————————————————————————————————————

#[tauri::command]
pub fn list_runtimes() -> Vec<Runtime> {
    let mut all = docker();
    all.extend(ollama());
    all.extend(jvm_daemons());
    // Running first, then grouped by provider, then by name.
    all.sort_by(|a, b| {
        (!a.running, &a.kind, &a.name).cmp(&(!b.running, &b.kind, &b.name))
    });
    all
}

#[tauri::command]
pub fn runtime_action(id: String, action: String) -> Result<(), String> {
    let (provider, native) = id
        .split_once(':')
        .ok_or_else(|| format!("malformed runtime id: {id}"))?;

    let run = |bin: PathBuf, args: &[&str]| -> Result<(), String> {
        let out = crate::ports::cmd(bin)
            .args(args)
            .output()
            .map_err(|e| format!("{provider} not available: {e}"))?;
        if out.status.success() {
            Ok(())
        } else {
            Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
        }
    };

    match (provider, action.as_str()) {
        ("docker", "start") => run(docker_bin(), &["start", native]),
        ("docker", "stop") => run(docker_bin(), &["stop", native]),
        ("docker", "remove") => run(docker_bin(), &["rm", "-f", native]),
        ("ollama", "stop") => run(ollama_bin(), &["stop", native]),
        ("jvm", "stop") => {
            let pid = native.parse().map_err(|_| format!("bad pid: {native}"))?;
            crate::ports::kill_process(pid)
        }
        _ => Err(format!("{provider} cannot {action}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_docker_ps_json() {
        let out = r#"{"ID":"a1b2","Names":"pg","Image":"postgres:16","State":"running","Ports":"0.0.0.0:5432->5432/tcp, :::5432->5432/tcp","Labels":"com.docker.compose.project=shop,maintainer=x"}
{"ID":"c3d4","Names":"cache","Image":"redis:7","State":"exited","Ports":"","Labels":""}"#;
        let rows = parse_docker(out);

        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].name, "pg");
        assert_eq!(
            rows[0].meta, "postgres:16 · shop · :5432",
            "image, compose project, and the port listed once"
        );
        assert_eq!(rows[1].meta, "redis:7", "no project, no ports, no stray dots");
        assert!(rows[0].running && rows[0].can_stop && !rows[0].can_start);
        assert!(!rows[1].running && rows[1].can_start && rows[1].can_remove);
    }

    #[test]
    fn compose_project_ignores_equals_inside_values() {
        let labels = "url=https://x.io/?a=b,com.docker.compose.project=bidbox,vendor=MinIO";
        assert_eq!(compose_project(labels), Some("bidbox".into()));
        assert_eq!(compose_project("maintainer=x"), None);
        assert_eq!(compose_project(""), None);
    }

    #[test]
    fn dedupes_ipv4_and_ipv6_port_mappings() {
        assert_eq!(
            published_ports("0.0.0.0:8080->80/tcp, :::8080->80/tcp, 0.0.0.0:9000->9000/tcp"),
            ":8080 :9000"
        );
        assert_eq!(published_ports(""), "");
    }

    #[test]
    fn parses_ollama_tables() {
        let list = "NAME              ID            SIZE      MODIFIED\n\
                    llama3.1:8b       42182419e950  4.7 GB    2 weeks ago\n\
                    qwen2.5:14b       7cdf5a0187d5  9.0 GB    3 days ago\n";
        assert_eq!(
            parse_ollama_list(list),
            vec![
                ("llama3.1:8b".to_string(), "4.7 GB".to_string()),
                ("qwen2.5:14b".to_string(), "9.0 GB".to_string()),
            ]
        );

        let ps = "NAME          ID            SIZE      PROCESSOR    UNTIL\n\
                  llama3.1:8b   42182419e950  6.1 GB    100% GPU     4 minutes from now\n";
        assert_eq!(parse_ollama_ps(ps), vec!["llama3.1:8b"]);
    }
}
