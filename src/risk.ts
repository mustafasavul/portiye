/**
 * What a bulk kill is about to break.
 *
 * Fast Kill exists to clear the dev processes that pile up — stray `node`
 * servers, orphaned `python` workers. The same gesture aimed at a database or
 * at the editor you are reading this in is a much worse day, so those names
 * carry an explicit warning into the confirmation.
 */
import type { Key } from "./i18n";

const RULES: { match: RegExp; warning: Key }[] = [
  {
    // Databases and brokers: killing them mid-write is how you lose data.
    match: /^(postgres|mysqld?|mariadb|mongod|redis|memcached|elasticsearch|rabbitmq|clickhouse)/i,
    warning: "risk.database",
  },
  {
    // The user is very likely reading this inside one of them.
    match: /^(Electron|Code|Cursor|Antigravity|JetBrains|idea|webstorm|pycharm|sublime|zed|jetbrains-toolbox)/i,
    warning: "risk.editor",
  },
  {
    // OS plumbing. Nothing good comes of this.
    match: /^(launchd|systemd|kernel_task|WindowServer|mDNSResponder|rapportd|sshd|coreaudiod|loginwindow|svchost|lsass|csrss|wininit)/i,
    warning: "risk.system",
  },
  {
    // Container and VM hosts: the children die with them.
    match: /^(docker|com\.docker|containerd|colima|podman|qemu|VBoxHeadless|vmware)/i,
    warning: "risk.container",
  },
  {
    // Device tooling — recoverable, but the emulator session is gone.
    match: /^(emulator|adb|netsimd|Simulator|simdiskimaged)/i,
    warning: "risk.device",
  },
];

/**
 * Coding agents work through a `node` or `python` process, so no name rule can
 * find them — the label the scan already worked out is the only handle there
 * is. An agent killed mid-run leaves its edits half applied, which is why
 * "kill all node" must say so first. Local inference servers are deliberately
 * absent: stopping Ollama frees the GPU and loses nothing.
 */
const AGENTS = new Set([
  "Claude",
  "Codex",
  "Antigravity",
  "Windsurf",
  "Cursor",
  "Aider",
  "Copilot",
  "MCP server",
]);

/**
 * The warning key for a process, or null when it is ordinary dev noise.
 * `ai` is the label from the port scan, where there is one.
 */
export function warningFor(name: string, ai?: string | null): Key | null {
  // The name rules come first: they know the consequence exactly, and an IDE
  // that hosts an agent is still an IDE with unsaved buffers in it.
  const named = RULES.find((r) => r.match.test(name))?.warning;
  if (named) return named;
  return ai && AGENTS.has(ai) ? "risk.agent" : null;
}
