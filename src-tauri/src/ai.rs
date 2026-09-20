//! Which processes on this machine are AI tools, and what they are.
//!
//! No kernel labels a process "AI". What it does hand over is argv, the
//! directory the process was started in, and the port it bound — enough for
//! the two families a developer cares about: local inference servers, which
//! hold the GPU and several gigabytes of weights, and coding agents, which sit
//! above a tree of `git` / `rg` / compiler children.
//!
//! Everything less certain than these gets no label. A process wrongly called
//! "Ollama" is worse than one called nothing, the same way a made-up gauge is
//! worse than a missing one.
//!
//! ponytail: substring matching over argv, not a process-map or open-handle
//! scan. `vmmap` / `/proc/pid/maps` / `Get-Process -Modules` would also catch
//! an unnamed `python` that loaded CUDA or Metal, but that is one subprocess
//! or one privileged read *per pid*, per tick — the very cost the device split
//! exists to avoid. The detail panel is where a per-pid probe would belong.

use serde::Serialize;
use std::collections::HashMap;

/// An agent works *for* you and edits things; a model server answers requests
/// and holds VRAM. The panel groups by this, and it is what decides whether a
/// stop needs a warning.
pub const AGENT: &str = "agent";
pub const MODEL: &str = "model";

/// Matched against argv plus the executable name, lowercased.
const AI_ARGV: &[(&str, &str, &str)] = &[
    // Local inference servers.
    ("ollama", "Ollama", MODEL),
    ("llama-server", "llama.cpp", MODEL),
    ("llama-cli", "llama.cpp", MODEL),
    ("lm studio", "LM Studio", MODEL),
    ("lmstudio", "LM Studio", MODEL),
    ("vllm", "vLLM", MODEL),
    ("sglang", "SGLang", MODEL),
    ("tritonserver", "Triton", MODEL),
    ("text-generation-launcher", "TGI", MODEL),
    ("localai", "LocalAI", MODEL),
    ("litellm", "LiteLLM", MODEL),
    ("open-webui", "Open WebUI", MODEL),
    ("comfyui", "ComfyUI", MODEL),
    // Agents and assistants. Most never listen on a port at all — they hold an
    // outbound TLS connection and fork tools — which is exactly why the panel
    // exists beside the port table rather than inside it.
    ("claude", "Claude", AGENT),
    ("codex", "Codex", AGENT),
    ("antigravity", "Antigravity", AGENT),
    ("windsurf", "Windsurf", AGENT),
    ("cursor.app", "Cursor", AGENT),
    ("cursor-agent", "Cursor", AGENT),
    ("aider", "Aider", AGENT),
    ("copilot", "Copilot", AGENT),
    ("modelcontextprotocol", "MCP server", AGENT),
];

/// The web UIs that launch as a bare `python main.py`: argv names nothing, so
/// the directory they were started in is the only thing that identifies them.
const AI_DIRS: &[(&str, &str, &str)] = &[
    ("comfyui", "ComfyUI", MODEL),
    ("stable-diffusion-webui", "Stable Diffusion WebUI", MODEL),
    ("automatic1111", "Stable Diffusion WebUI", MODEL),
    ("text-generation-webui", "Text generation WebUI", MODEL),
    ("invokeai", "InvokeAI", MODEL),
    ("fooocus", "Fooocus", MODEL),
];

/// Ports these tools bind by default. Last resort: it is the only signal left
/// when argv belongs to another user and comes back empty.
const AI_PORTS: &[(u16, &str)] = &[
    (11434, "Ollama"),
    (1234, "LM Studio"),
    (8188, "ComfyUI"),
    (7860, "Gradio"),
];

/// The platform's own services are never AI tools, and their paths collide
/// with the table above: `CursorUIViewService` is macOS text input, not the
/// editor, and the cryptex bootstrap path literally contains "codex". One
/// guard in front of the tables beats a needle tuned per false positive.
const SYSTEM_PREFIXES: &[&str] = &[
    "/system/",
    "/usr/libexec/",
    "/usr/lib/systemd/",
    "/var/run/com.apple.security.cryptexd/",
    "c:\\windows\\",
];

/// `(name, agent-or-model)`, or `None` when nothing here says "AI".
/// Pass `port` 0 for a process that holds none.
fn classify(
    argv: &str,
    name: &str,
    cwd: Option<&str>,
    port: u16,
) -> Option<(&'static str, &'static str)> {
    let hay = format!("{argv} {name}").to_ascii_lowercase();
    if SYSTEM_PREFIXES.iter().any(|p| hay.starts_with(p)) {
        return None;
    }
    if let Some((_, label, kind)) = AI_ARGV.iter().find(|(needle, _, _)| hay.contains(needle)) {
        return Some((label, kind));
    }

    let dir = cwd.unwrap_or_default().to_ascii_lowercase();
    if let Some((_, label, kind)) = AI_DIRS.iter().find(|(needle, _, _)| dir.contains(needle)) {
        return Some((label, kind));
    }

    AI_PORTS
        .iter()
        .find(|(p, _)| *p == port && *p != 0)
        .map(|(_, label)| (*label, MODEL))
}

/// The label for a listening process, for the badge in the port table.
pub fn label_for(argv: &str, name: &str, cwd: Option<&str>, port: u16) -> Option<String> {
    classify(argv, name, cwd, port).map(|(label, _)| label.to_string())
}

#[derive(Serialize, Clone, Debug)]
pub struct AiProc {
    pub pid: u32,
    pub name: String,
    pub memory: u64,
}

/// One tool, not one process: Codex alone is a dozen Electron helpers, and a
/// dozen rows for one app is the same mistake the tray made with ports.
#[derive(Serialize, Clone, Debug)]
pub struct AiTool {
    pub name: String,
    /// `AGENT` or `MODEL`; the window translates it.
    pub kind: String,
    pub memory: u64,
    pub cpu: f32,
    /// Every process behind it, so a stop takes the whole thing down and the
    /// confirmation can list what it is about to end.
    pub procs: Vec<AiProc>,
    /// The ports it is listening on, where it listens at all. Most agents do
    /// not, which is the whole reason this panel is not the port table.
    pub ports: Vec<u16>,
}

/// Every AI tool running right now, heaviest first.
///
/// Reads the poller's own `System` rather than building one: this costs a walk
/// over a process list that was refreshed a moment ago, and it is the only
/// instance with two samples behind it, so `cpu` is a real percentage instead
/// of the zero a fresh `System` always reports.
#[tauri::command]
pub fn list_ai_tools(watch: tauri::State<crate::watch::Watch>) -> Vec<AiTool> {
    let listening = watch.ports();
    let own = std::process::id();

    let mut by_tool: HashMap<&'static str, AiTool> = HashMap::new();
    watch.with_system(|sys| {
        for (pid, proc) in sys.processes() {
            let pid = pid.as_u32();
            if pid == own {
                continue;
            }
            let argv = proc
                .cmd()
                .iter()
                .map(|a| a.to_string_lossy())
                .collect::<Vec<_>>()
                .join(" ");
            let name = proc.name().to_string_lossy().into_owned();
            let cwd = proc.cwd().map(|c| c.to_string_lossy().into_owned());

            let Some((label, kind)) = classify(&argv, &name, cwd.as_deref(), 0) else {
                continue;
            };

            let row = by_tool.entry(label).or_insert_with(|| AiTool {
                name: label.to_string(),
                kind: kind.to_string(),
                memory: 0,
                cpu: 0.0,
                procs: Vec::new(),
                ports: Vec::new(),
            });
            row.memory += proc.memory();
            row.cpu += proc.cpu_usage();
            row.procs.push(AiProc {
                pid,
                name,
                memory: proc.memory(),
            });
        }
    });

    // The ports come from the same scan the table draws, so a tool cannot be
    // shown here holding a port the list beside it disagrees about.
    for entry in &listening {
        if let Some(label) = &entry.ai {
            if let Some(row) = by_tool.get_mut(label.as_str()) {
                if !row.ports.contains(&entry.port) {
                    row.ports.push(entry.port);
                }
            }
        }
    }

    let mut all: Vec<AiTool> = by_tool.into_values().collect();
    for row in &mut all {
        row.procs.sort_by_key(|p| std::cmp::Reverse(p.memory));
        row.ports.sort_unstable();
    }
    all.sort_by_key(|t| std::cmp::Reverse(t.memory));
    all
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_the_ai_tool_behind_a_process() {
        // argv is the strongest signal, and it beats a coincidental port.
        assert_eq!(
            classify("/usr/local/bin/ollama serve", "ollama", None, 11434),
            Some(("Ollama", MODEL))
        );
        assert_eq!(
            classify(
                "python -m vllm.entrypoints.openai.api_server",
                "python3",
                None,
                8000
            ),
            Some(("vLLM", MODEL))
        );
        // A bare `python main.py` is named only by the directory it runs in.
        assert_eq!(
            classify(
                "python main.py",
                "python3",
                Some("/Users/me/stable-diffusion-webui"),
                7861
            ),
            Some(("Stable Diffusion WebUI", MODEL))
        );
        // Another user's process: no argv, no cwd — the port is all there is.
        assert_eq!(classify("", "", None, 11434), Some(("Ollama", MODEL)));
    }

    #[test]
    fn an_agent_is_an_agent_wherever_it_is_found() {
        assert_eq!(
            classify(
                "/Applications/ChatGPT.app/Contents/Resources/codex app-server",
                "codex",
                None,
                0
            ),
            Some(("Codex", AGENT))
        );
        // A port of 0 means "this process holds none" — it must never match the
        // defaults table, or every portless process would come back as Ollama.
        assert_eq!(classify("node index.js", "node", None, 0), None);
    }

    #[test]
    fn the_platforms_own_services_are_never_ai() {
        // macOS text input, not the editor — and it was matching "cursor".
        assert_eq!(
            classify(
                "/System/Library/PrivateFrameworks/TextInputUIMacHelper.framework/Versions/A/XPCServices/CursorUIViewService.xpc/Contents/MacOS/CursorUIViewService",
                "CursorUIViewService",
                None,
                0
            ),
            None
        );
        // The cryptex bootstrap path contains "codex".
        assert_eq!(
            classify(
                "/var/run/com.apple.security.cryptexd/codex.system/bootstrap/usr/bin/something",
                "something",
                None,
                0
            ),
            None
        );
        // The real one still matches.
        assert_eq!(
            classify(
                "/Applications/Cursor.app/Contents/MacOS/Cursor",
                "Cursor",
                None,
                0
            ),
            Some(("Cursor", AGENT))
        );
    }

    #[test]
    fn leaves_ordinary_dev_servers_unlabelled() {
        // The badge only appears when something actually says "AI"; a plain
        // dev server on a plain port stays plain.
        assert_eq!(
            classify("node server.js", "node", Some("/Users/me/shop"), 3000),
            None
        );
        assert_eq!(classify("postgres -D /data", "postgres", None, 5432), None);
    }
}
