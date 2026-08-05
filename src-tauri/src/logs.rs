//! Device log streaming.
//!
//! One stream at a time, deliberately: two log firehoses into one webview is
//! more than anyone reads, and a single child process is far easier to shut
//! down cleanly than a registry of them.

use std::io::{BufRead, BufReader};
use std::process::{Child, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, Runtime};

#[derive(Default)]
pub struct Logs {
    child: Mutex<Option<Child>>,
    /// Bumped on every start/stop; a reader thread whose generation is stale
    /// stops emitting, so a restarted stream never interleaves with the old one.
    generation: Mutex<u64>,
}

impl Logs {
    pub fn new() -> Self {
        Self::default()
    }
}

fn stop_inner(logs: &Logs) {
    if let Some(mut child) = logs.child.lock().unwrap().take() {
        let _ = child.kill();
        let _ = child.wait(); // reap, or the emulator leaves a zombie
    }
    *logs.generation.lock().unwrap() += 1;
}

/// `id` is `sim:<udid>` or `avd:<serial>` — the same scheme the tray uses.
#[tauri::command]
pub fn start_logs<R: Runtime>(app: AppHandle<R>, id: String) -> Result<(), String> {
    let logs = app.state::<Logs>();
    stop_inner(&logs);

    let (kind, target) = id
        .split_once(':')
        .ok_or_else(|| format!("malformed device id: {id}"))?;

    let mut command = match kind {
        "sim" => {
            let mut c = crate::ports::cmd("xcrun");
            c.args([
                "simctl", "spawn", target, "log", "stream", "--level", "info",
                "--style", "compact",
            ]);
            c
        }
        "avd" => {
            let mut c = crate::ports::cmd(crate::avd::adb_bin());
            // -v brief keeps a line readable in a narrow panel.
            c.args(["-s", target, "logcat", "-v", "brief"]);
            c
        }
        other => return Err(format!("no log source for {other}")),
    };

    let mut child = command
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("could not start the log stream: {e}"))?;

    let stdout = child.stdout.take().ok_or("log stream produced no output")?;
    let stderr = child.stderr.take();

    let generation = {
        let mut g = logs.generation.lock().unwrap();
        *g += 1;
        *g
    };
    *logs.child.lock().unwrap() = Some(child);

    let pump = move |app: AppHandle<R>, reader: Box<dyn BufRead + Send>, channel: &'static str| {
        std::thread::spawn(move || {
            for line in reader.lines().map_while(Result::ok) {
                // The stream outlived its start: drop it rather than mixing
                // two devices' output into one view.
                if *app.state::<Logs>().generation.lock().unwrap() != generation {
                    return;
                }
                let _ = app.emit(channel, line);
            }
            let _ = app.emit("log-ended", ());
        });
    };

    pump(app.clone(), Box::new(BufReader::new(stdout)), "log-line");
    if let Some(err) = stderr {
        // Tool errors ("no devices found") belong in the same view, or the
        // panel just sits empty with no explanation.
        pump(app, Box::new(BufReader::new(err)), "log-line");
    }
    Ok(())
}

#[tauri::command]
pub fn stop_logs<R: Runtime>(app: AppHandle<R>) {
    stop_inner(&app.state::<Logs>());
}
