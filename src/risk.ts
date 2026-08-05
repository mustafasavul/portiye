/**
 * What a bulk kill is about to break.
 *
 * Fast Kill exists to clear the dev processes that pile up — stray `node`
 * servers, orphaned `python` workers. The same gesture aimed at a database or
 * at the editor you are reading this in is a much worse day, so those names
 * carry an explicit warning into the confirmation.
 */
const RULES: { match: RegExp; warning: string }[] = [
  {
    // Databases and brokers: killing them mid-write is how you lose data.
    match: /^(postgres|mysqld?|mariadb|mongod|redis|memcached|elasticsearch|rabbitmq|clickhouse)/i,
    warning:
      "This is a database or message broker. Killing it mid-write can lose or corrupt uncommitted data — stop it through its own service manager instead.",
  },
  {
    // The user is very likely reading this inside one of them.
    match: /^(Electron|Code|Cursor|Antigravity|JetBrains|idea|webstorm|pycharm|sublime|zed|jetbrains-toolbox)/i,
    warning:
      "This looks like an editor or IDE — quite possibly the one you have open. Killing it drops unsaved work.",
  },
  {
    // OS plumbing. Nothing good comes of this.
    match: /^(launchd|systemd|kernel_task|WindowServer|mDNSResponder|rapportd|sshd|coreaudiod|loginwindow|svchost|lsass|csrss|wininit)/i,
    warning:
      "This is an operating-system service, not a dev process. Killing it can log you out or destabilise the machine.",
  },
  {
    // Container and VM hosts: the children die with them.
    match: /^(docker|com\.docker|containerd|colima|podman|qemu|VBoxHeadless|vmware)/i,
    warning:
      "This hosts containers or virtual machines. Everything running inside it goes down too.",
  },
  {
    // Device tooling — recoverable, but the emulator session is gone.
    match: /^(emulator|adb|netsimd|Simulator|simdiskimaged)/i,
    warning:
      "This backs a running emulator or simulator. The device session ends and unsaved app state is lost.",
  },
];

/** The warning for a process name, or null when it is ordinary dev noise. */
export function warningFor(name: string): string | null {
  return RULES.find((r) => r.match.test(name))?.warning ?? null;
}
