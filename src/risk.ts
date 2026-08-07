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

/** The warning key for a process name, or null when it is ordinary dev noise. */
export function warningFor(name: string): Key | null {
  return RULES.find((r) => r.match.test(name))?.warning ?? null;
}
