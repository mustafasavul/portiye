# portiye

[![CI](https://github.com/mustafasavul/portiye/actions/workflows/ci.yml/badge.svg)](https://github.com/mustafasavul/portiye/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-24C8DB.svg)](https://tauri.app)

A menu-bar app for the ports on your machine — and everything behind them.

Which process is on `:3000`, which project it was started from, and how to stop
it without hunting for a PID. Plus the emulators, simulators, containers and
build daemons that opened half of those ports in the first place.

macOS, Linux and Windows. The window is optional; the tray does the daily work.

---

## What it does

- **Listening ports, grouped by process family.** `emulator` and the `qemu` it
  spawned are one row, not two, and killing the row takes the tree with it.
- **Who owns it.** The `.app`, the AVD or the project directory a process was
  started from — not just an executable name.
- **Fast Kill.** One click clears every stray `node`, `python` or JVM process,
  with a confirmation that names each one first.
- **Guardrails.** Databases, editors, OS services and container hosts carry an
  explicit warning into the confirmation. Nothing is ever killed silently.
- **History.** What opened, what closed, and when a *different* process took a
  port over — recorded while the window is shut.
- **Device logs.** `simctl log stream` and `adb logcat`, filtered and
  exportable.
- **Export.** JSON or CSV snapshot to `~/Downloads`.
- **28 languages, right-to-left included.** Window and tray, with full layout
  mirroring for العربية, עברית, فارسی and اردو.
- **Start at login**, toggled from the toolbar.

## Install

Grab the installer for your platform from
[Releases](https://github.com/mustafasavul/portiye/releases).

| Platform | File |
|---|---|
| macOS (Apple silicon / Intel) | `.dmg` |
| Windows | `.msi` / `.exe` |
| Linux | `.AppImage` / `.deb` / `.rpm` |

> macOS builds are not notarised yet. First launch: right-click the app →
> **Open**, or `xattr -dr com.apple.quarantine /Applications/portiye.app`.

## Build from source

Prerequisites: [Rust](https://rustup.rs), Node 20+, and the
[Tauri system dependencies](https://tauri.app/start/prerequisites/) for your
platform.

```bash
npm install
npm run tauri dev          # the real app
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

One poller, in Rust. `watch.rs` scans every five seconds, diffs the snapshot,
records history and emits `ports-changed`; the window and the tray both read
its cache instead of scanning for themselves. That single `System` instance is
also what makes the CPU percentages real — sysinfo needs two samples of the
same instance to compare.

Everything else is in [CLAUDE.md](CLAUDE.md): the layout, the decisions worth
not re-litigating, and the traps that cost real debugging time.

## Languages

English · العربية · አማርኛ · বাংলা · Deutsch · Español · فارسی · Filipino ·
Hausa · עברית · हिन्दी · Bahasa Indonesia · Қазақша · Кыргызча ·
Bahasa Melayu · Nederlands · Português (Brasil) · Русский · Kiswahili · ไทย ·
Türkmençe · Türkçe · اردو · Oʻzbekcha · Tiếng Việt · Yorùbá · 中文 · isiZulu

The app picks your system language on first run and remembers what you choose
after that.

### Adding one

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
working app.

## Contributing

Issues and pull requests are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).
By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE) © Mustafa Savul
