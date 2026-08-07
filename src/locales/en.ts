/**
 * The source of truth.
 *
 * Every other locale is a `Partial` of this, so a key that exists here and
 * nowhere else still renders — in English. Add a string here first.
 */
export const en = {
  "nav.ports": "Ports",
  "nav.history": "History",
  "nav.logs": "Device Logs",
  "nav.view": "View",

  "toolbar.exportFormat": "Export format",
  "toolbar.export": "Export",
  "toolbar.exportTitle": "Export the current table to your Downloads folder (⌘E)",
  "toolbar.refresh": "Refresh now",
  "toolbar.refreshTitle": "Refresh now (⌘R)",
  "toolbar.toLight": "Switch to light theme",
  "toolbar.toDark": "Switch to dark theme",
  "toolbar.language": "Language",
  "toolbar.autostart": "Start at login",
  "toolbar.autostartOn": "portiye starts with your session",
  "toolbar.autostartOff": "portiye does not start with your session",

  "banner.dismiss": "Dismiss",
  "banner.dismissError": "Dismiss error",
  "banner.reveal": "Reveal",

  "devices.title": "Devices",
  "devices.runtimes": "Runtimes",
  "devices.count": "{running} / {total} running",
  "devices.empty":
    "No emulators or simulators found. Create one in Android Studio, or install Xcode for iOS devices.",

  "device.launch": "Launch",
  "device.stop": "Stop",
  "device.start": "Start",
  "device.boot": "Boot",
  "device.shutdown": "Shutdown",
  "device.restart": "Restart",
  "device.restartTitle": "Stop and start {name} again, keeping its data",
  "device.wipe": "Wipe",
  "device.erase": "Erase",
  "device.remove": "Remove",
  "device.resetTitle": "Reset {name}?",
  "device.wipeWarning":
    "All apps, data and snapshots are erased, then it cold boots.",
  "device.eraseWarning": "All apps, data and caches are wiped.",
  "device.removeWarning": "The container and its writable layer are deleted.",

  "ports.title": "Listening ports",
  "ports.filter": "Filter ports",
  "ports.filterAria": "Filter ports by number, process or path",
  "ports.flagOver": "Flag over",
  "ports.flagAria": "Flag processes using more memory than",
  "ports.killSelected": "Kill {n} selected",
  "ports.killSelectedTitle": "Kill the selected processes (⌘⌫)",
  "ports.emptyNone": "Nothing is listening on this machine.",
  "ports.emptyFilter": "No port matches “{q}”.",
  "ports.clearFilter": "Clear filter",

  "table.port": "Port",
  "table.process": "Process",
  "table.memory": "Memory",
  "table.pid": "PID",
  "table.group": "Group",
  "table.selectAll": "Select all shown",
  "table.clearSelection": "Clear selection",
  "table.selectRow": "Select {name}, pid {pid}",
  "table.kill": "Kill",
  "table.killAria": "Kill {name} on {ports}",
  "table.hot": "Above your memory threshold",
  "table.sortAsc": "ascending",
  "table.sortDesc": "descending",
  "table.sortAria": "Sort by {column}, {dir}",

  "fastkill.kill": "Kill {n}",
  "fastkill.runtime": "runtime",
  "fastkill.titleRuntime": "Kill every {name} process: {names}",
  "fastkill.titleName": "Kill all {n} {name} processes",

  "confirm.cancel": "Cancel",

  "kill.titleSelected": "Kill {n} selected processes?",
  "kill.titleSelectedOne": "Kill 1 selected process?",
  "kill.titleGroup": "Kill {n} {name} processes?",
  "kill.titleOne": "Kill {name}?",
  "kill.note": "Processes they started are killed too.",
  "kill.confirm": "Kill {n}",
  "kill.children": "Killed {n} + {c} child processes",
  "kill.childrenOne": "Killed {n} + 1 child process",
  "kill.deniedTitle": "{n} of {total} refused to close",
  "kill.deniedProcess": "process",
  "kill.deniedWarning": "They belong to another user. {hint}",
  "kill.retryElevated": "Retry as administrator",

  "export.notice": "Exported {n} rows",

  "history.title": "Port history",
  "history.clear": "Clear",
  "history.empty":
    "Nothing has opened or closed since portiye started. Events appear here as they happen, including while the window is closed.",
  "history.tookOver": "took over from {name}",
  "history.showOlder": "Show {n} older",
  "history.more": "{n} more",
  "history.secondsAgo": "{n}s ago",
  "history.minutesAgo": "{n}m ago",

  "detail.aria": "Details for process {pid}",
  "detail.close": "Close details",
  "detail.reading": "Reading…",
  "detail.cpu": "CPU",
  "detail.memory": "Memory",
  "detail.uptime": "Uptime",
  "detail.user": "User",
  "detail.directory": "Directory",
  "detail.command": "Command",
  "detail.tree": "Process tree",
  "detail.connections": "Connections",
  "detail.noSockets": "No open sockets.",
  "detail.openFiles": "Open files",
  "detail.noFiles": "No regular files open.",
  "detail.andMore": "and {n} more",
  "detail.kill": "Kill this process",

  "logs.title": "Device logs",
  "logs.source": "Log source",
  "logs.off": "Off",
  "logs.filter": "Filter lines",
  "logs.filterAria": "Filter log lines",
  "logs.follow": "Follow",
  "logs.copy": "Copy",
  "logs.export": "Export",
  "logs.exportTitle": "Write these lines to your Downloads folder",
  "logs.copied": "Copied {n} lines",
  "logs.copyFailed":
    "Could not reach the clipboard — select the lines and press ⌘C",
  "logs.exported": "Exported {n} lines → {path}",
  "logs.emptyNoDevice": "Start a simulator or emulator to stream its log.",
  "logs.emptyPick": "Pick a device above to start streaming.",

  "risk.database":
    "This is a database or message broker. Killing it mid-write can lose or corrupt uncommitted data — stop it through its own service manager instead.",
  "risk.editor":
    "This looks like an editor or IDE — quite possibly the one you have open. Killing it drops unsaved work.",
  "risk.system":
    "This is an operating-system service, not a dev process. Killing it can log you out or destabilise the machine.",
  "risk.container":
    "This hosts containers or virtual machines. Everything running inside it goes down too.",
  "risk.device":
    "This backs a running emulator or simulator. The device session ends and unsaved app state is lost.",
};

/** Every string the app can show. */
export type Key = keyof typeof en;

/** A translation: as complete as it is, missing keys fall back to English. */
export type Strings = Partial<Record<Key, string>>;
