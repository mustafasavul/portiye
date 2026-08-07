# portiye — find what's using a port, and stop it

[![CI](https://github.com/mustafasavul/portiye/actions/workflows/ci.yml/badge.svg)](https://github.com/mustafasavul/portiye/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-24C8DB.svg)](https://tauri.app)
[![Platforms](https://img.shields.io/badge/platforms-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey.svg)](#install)
[![Languages](https://img.shields.io/badge/languages-28-informational.svg)](#languages)

**portiye is a free, open-source, cross-platform desktop app that shows every
listening port on your computer, which process owns it, and which project that
process was started from — and lets you kill it in one click.** It runs from
the menu bar / system tray on macOS, Linux and Windows, and also manages the
Android emulators, iOS simulators, Docker containers and build daemons that
opened half of those ports in the first place.

It is a graphical answer to `lsof -i :3000`, `netstat -ano` and
`EADDRINUSE: address already in use` — with a confirmation dialog that names
exactly what is about to die.

---

## Contents

- [Why](#why)
- [What it does](#what-it-does)
- [Install](#install)
- [Common tasks](#common-tasks)
- [How it compares](#how-it-compares-to-lsof-netstat-and-activity-monitor)
- [FAQ](#faq)
- [Languages](#languages)
- [Build from source](#build-from-source)
- [How it works](#how-it-works)
- [Contributing](#contributing)

## Why

You run `npm run dev` and get `Error: listen EADDRINUSE: address already in
use :::3000`. Something is on port 3000. You do not know what, and you have
four terminals open.

The usual path is `lsof -i :3000`, squint at a PID, `kill -9` it, discover the
real server was a *child* of the thing you killed and is still holding the
port. portiye collapses that into: open the menu bar, read the row that says
`:3000 · node · ~/dev/shop`, click **Kill**. Its children go with it.

Then multiply that by the six stray `node`, `python` and JVM processes still
running from yesterday.

## What it does

- **Lists every listening port**, grouped by process family. `emulator` and the
  `qemu` it spawned are one row, not two, and killing the row takes the whole
  tree down — no orphaned server left holding the port.
- **Says who owns it.** The `.app` bundle, the AVD, or the project directory a
  process was started from. `~/dev/shop` beats a bare `node`.
- **Fast Kill.** One click clears every stray `node`, `python`, JVM, .NET, Go,
  Ruby, PHP, Rust or Dart process, with a confirmation that names each one.
- **Guardrails before anything dies.** Databases (`postgres`, `mysqld`,
  `mongod`, `redis`), editors and IDEs, OS services and container hosts each
  carry an explicit warning into the confirmation. Nothing is ever killed
  silently.
- **Elevation when the OS refuses.** Retries under `sudo` / UAC / polkit, and
  says which one is about to ask.
- **Port history.** What opened, what closed, and when a *different* process
  took a port over — recorded while the window is closed.
- **Emulators, simulators, containers, daemons.** Android AVDs, iOS
  simulators, Docker containers, Ollama models and JVM build daemons: start,
  stop, restart, wipe.
- **Live device logs.** `simctl log stream` and `adb logcat`, filtered,
  copyable, exportable.
- **Export.** JSON or CSV snapshot of what is listening, to `~/Downloads`.
- **28 languages, right-to-left included** — see [Languages](#languages).
- **Start at login**, toggled from the toolbar.
- **No telemetry, no account, no network calls.** It reads your machine and
  that is all.

## Install

Download the installer for your platform from
[**Releases**](https://github.com/mustafasavul/portiye/releases).

| Platform | File | Notes |
|---|---|---|
| macOS (Apple silicon & Intel) | `.dmg` | Not notarised yet — see below |
| Windows 10 / 11 | `.msi` or `.exe` | |
| Linux | `.AppImage`, `.deb`, `.rpm` | needs `lsof` |

macOS first launch: right-click the app → **Open**, or clear the quarantine
flag yourself:

```bash
xattr -dr com.apple.quarantine /Applications/portiye.app
```

Prefer to build it? See [Build from source](#build-from-source).

## Common tasks

### Find out what is running on port 3000

Open portiye, type `3000` in the filter. The row shows the port, the process
name, the directory it was launched from, its memory, and its PID.

The terminal equivalents, for reference:

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

```bash
netstat -ano | findstr :3000
```

### Kill the process using a port

Click **Kill** on the row. portiye also kills whatever that process spawned,
which is the part `kill -9 <pid>` gets wrong — killing a `npm run dev` or
`dotnet watch` on its own leaves the real server running and orphaned, still
holding the port.

### Kill every Node.js (or Python, or JVM) process at once

A Node project shows up as `node`, `vite`, `esbuild`, `next-server` and
`nodemon` all at once, so grouping by executable name never gathers it. Fast
Kill has a **Node.js** chip that sweeps all of them, and the confirmation
lists every PID first.

### Free a port without opening the window

The menu-bar / tray menu lists the ports on its own. Click one, it dies.

### Stop an Android emulator or iOS simulator

The Devices panel, or the tray menu. Restart keeps the data; Wipe / Erase does
not, and says so before you agree.

## How it compares to lsof, netstat and Activity Monitor

| | portiye | `lsof` / `netstat` | Activity Monitor / Task Manager |
|---|---|---|---|
| Shows listening ports | yes | yes | Windows: partly; macOS: no |
| Says which *project* a process belongs to | yes | no | no |
| Kills child processes too | yes | no | no |
| Warns before killing a database or your editor | yes | no | no |
| Groups a process tree into one row | yes | no | partly |
| Records port takeovers over time | yes | no | no |
| Manages emulators / containers | yes | no | no |
| Works without a terminal | yes | no | yes |
| Cross-platform, one interface | yes | different flags per OS | no |

portiye does not replace `lsof` for scripting. It replaces the twelve seconds
of squinting between "something is on the port" and "it is gone".

## FAQ

### Is portiye free?

Yes. MIT licensed, no paid tier, no account.

### Does it send anything over the network?

No. There is no telemetry, no update ping, no analytics. It reads local
process and socket state and writes only when you export a file.

### Which operating systems does it support?

macOS, Linux and Windows, from one codebase. macOS is the daily driver; Linux
and Windows are compiled and tested in CI.

### Do I need sudo or admin rights?

Not for your own processes. When the OS refuses — a process owned by another
user — portiye offers to retry with elevation and tells you which prompt is
about to appear.

### Is it safe to kill a process from here?

For dev servers, yes: that is what it is for. Databases, editors, OS services
and container hosts carry an explicit warning into the confirmation, and every
destructive action lists exactly what it will affect before you agree. Nothing
happens without a click.

### Why did it kill more processes than I selected?

Because the one you selected spawned them. A `npm run dev` supervises the real
server; killing the supervisor alone leaves the port occupied. The
confirmation says "Processes they started are killed too."

### What is a "family" in the port list?

A process and its listening descendants, collapsed into one row — `emulator`
plus the `qemu` it spawned, or `adb` plus its server. Sorting by **Group**
orders by how many processes belong together.

### Does it work with Docker, WSL, or Podman?

Docker containers appear in the Runtimes panel with start / stop / remove.
Ports published by a container appear in the port list like any other
listener. Podman and Colima are recognised as container hosts for the purpose
of kill warnings. WSL: ports forwarded to Windows appear; processes inside the
VM are managed inside it.

### How is this different from the `kill-port` npm package?

`kill-port` frees a port you already know about, from a script. portiye is for
the moment you do not know what is on the port, do not know what killing it
will take down, and would rather see it than guess.

### Does it run in the background?

It lives in the menu bar / system tray. Closing the window keeps it running;
the scanner keeps recording history. Quit from the tray menu to stop it.

### How much does it cost to run?

One scan every five seconds, shared by the window, the tray and the history.
Device enumeration (`simctl list`, `docker ps`) runs on a slow 30-second timer
instead, because those shell out and cost real time.

## Languages

English · العربية · አማርኛ · বাংলা · Deutsch · Español · فارسی · Filipino ·
Hausa · עברית · हिन्दी · Bahasa Indonesia · Қазақша · Кыргызча ·
Bahasa Melayu · Nederlands · Português (Brasil) · Русский · Kiswahili · ไทย ·
Türkmençe · Türkçe · اردو · Oʻzbekcha · Tiếng Việt · Yorùbá · 中文 · isiZulu

Arabic, Hebrew, Persian and Urdu mirror the entire layout. The app picks your
system language on first run and remembers what you choose after that.

### Adding a language

One file per language in `src/locales/`, plus a row in `src/locales/index.ts`:

```bash
cp src/locales/en.ts src/locales/xx.ts   # then translate the values
```

Set `rtl: true` in the registry row for a right-to-left language; the layout
mirrors itself from there, because the stylesheet uses logical properties
rather than `left` and `right`.

The thirteen strings in the menu-bar menu live separately in
`src-tauri/src/i18n.rs` — the tray is native and cannot read the webview's
table. `npm run check` verifies that no locale has a typo'd key or a dropped
`{placeholder}`, and `cargo test` that no tray table is missing a string.

Missing keys fall back to English, so a partial translation still ships a
working app. Translation fixes are the easiest contribution to make here.

## Build from source

Prerequisites: [Rust](https://rustup.rs), Node 20+, and the
[Tauri system dependencies](https://tauri.app/start/prerequisites/) for your
platform.

```bash
git clone https://github.com/mustafasavul/portiye.git
```

```bash
cd portiye && npm install
```

```bash
npm run tauri dev          # the real app
```

```bash
npm run tauri build        # a bundle in src-tauri/target/release/bundle
```

Tests and checks:

```bash
cd src-tauri && cargo test
```

```bash
npm run check
```

`npm run dev` renders the UI in Chromium alone — fast for styling, but it is
not the engine the app ships on. Verify anything behavioural in
`npm run tauri dev`.

## How it works

**One poller, in Rust.** `watch.rs` scans every five seconds, diffs the
snapshot, records history and emits `ports-changed`; the window and the tray
both read its cache instead of scanning for themselves. That single `System`
instance is also what makes the CPU percentages real — sysinfo needs two
samples of the same instance to compare.

Ports come from `lsof` on macOS and Linux and `netstat` on Windows, joined
with process metadata from [sysinfo](https://crates.io/crates/sysinfo). The UI
is React 19 + TypeScript in a [Tauri 2](https://tauri.app) webview — a native
WebView rather than a bundled Chromium, so the whole app is a few tens of
megabytes rather than a few hundred.

Everything else is in [CLAUDE.md](CLAUDE.md): the layout, the decisions worth
not re-litigating, and the traps that cost real debugging time.

## Contributing

Issues, translations and small focused pull requests are welcome — see
[CONTRIBUTING.md](CONTRIBUTING.md). By participating you agree to the
[Code of Conduct](CODE_OF_CONDUCT.md). Security reports go through
[SECURITY.md](SECURITY.md), privately.

## License

[MIT](LICENSE) © Mustafa Savul

---

<sub>portiye is a port manager, port monitor and process killer for developers
— an open-source GUI alternative to `lsof -i`, `netstat -ano`, `ss -ltnp`,
`fuser -k`, `kill -9` and `npx kill-port`. It answers "what is running on port
3000", "how do I fix EADDRINUSE / address already in use", "which process is
using this port on macOS, Windows or Linux", and "how do I kill a stuck dev
server and its children". Menu bar app · system tray app · Tauri · Rust ·
React · macOS · Linux · Windows · Android emulator manager · iOS simulator
manager · Docker container manager.</sub>
