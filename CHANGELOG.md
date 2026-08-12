# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0]

### Added

- A **System** panel between the devices and the ports: whole-machine CPU,
  GPU, memory and disk, each with a bar that turns amber past 75% and red
  past 90%. The same four figures appear as a one-line readout at the top of
  the tray menu, so `CPU 45% · GPU 0% · RAM 55% · DISK 96%` is one click away
  without opening the window.
- GPU load where the platform will give it up without root: `ioreg` on macOS,
  `gpu_busy_percent` or `nvidia-smi` on Linux, `nvidia-smi` on Windows.

  These are host-wide figures deliberately. Emulators and simulators share the
  machine — an iOS simulator is not an isolated process at all — so there is no
  honest per-device number to put in a row.

### Fixed

- A machine without the Android SDK lost its **simulators and its Docker
  containers too**, and showed an `emulator not found` banner every 30
  seconds. `list_avds` returned an error where `list_simulators` returned an
  empty list, and the window fetched all three with `Promise.all`, so one
  rejection discarded the two results that did arrive. Listers now agree that
  a missing toolchain is a machine, not a fault, and the window uses
  `allSettled`.
- Memory read a near-constant 85% and never moved. `sysinfo`'s `used_memory()`
  is `total - free`, and macOS keeps almost nothing free — it lends the rest
  out as cache — so the number sat pinned near the total. It is now
  `total - available`, which answers "how much room is left" and actually
  changes.

### Changed

- Nothing a platform cannot show is drawn any more: no GPU counter, no GPU
  gauge; no fixed volume, no disk gauge; the Device Logs tab is gone on a
  machine with neither Xcode nor the Android SDK; the elevated-retry button
  is gone on a Linux box without polkit; and Windows no longer reports an
  `lsof` error in every process detail panel about a tool it was never going
  to have.

## [0.2.1]

### Fixed

- `cargo clippy -D warnings` failed on Linux and Windows while passing on
  macOS: `kill_processes_elevated` built one list of PIDs that only the macOS
  branch used, and `cmd()` returned early out of a `#[cfg(windows)]` block.
  Each `#[cfg]` branch now builds its own arguments. No behaviour change — the
  same processes are killed the same way.
- The two process-killing tests build their fixture from `sleep` and `sh -c`,
  which Windows does not have, so they are `#[cfg(unix)]`. Windows runs the
  other 23. What is gated is the fixture, not the coverage.

### Changed

- README rewritten around the questions people actually arrive with — what is
  on port 3000, how to fix `EADDRINUSE`, how to kill a dev server and its
  children — with a comparison against `lsof`, `netstat` and Activity Monitor,
  and an FAQ. Package and bundle descriptions and keywords updated to match.
- `CONTRIBUTING.md` and `CLAUDE.md` document how to check the Windows target
  from macOS: Homebrew's `llvm` ships the `llvm-rc` that `tauri-winres` needs.

## [0.2.0]

### Added

- **23 more languages, for 28 in total**: العربية, አማርኛ, বাংলা, فارسی,
  Filipino, Hausa, עברית, हिन्दी, Bahasa Indonesia, Қазақша, Кыргызча,
  Bahasa Melayu, Nederlands, Português (Brasil), Русский, Kiswahili, ไทย,
  Türkmençe, اردو, Oʻzbekcha, Tiếng Việt, Yorùbá, isiZulu — alongside the
  existing English, Türkçe, Español, Deutsch and 中文.
- **Right-to-left support.** العربية, עברית, فارسی and اردو mirror the whole
  layout. The stylesheet moved to logical properties, so this is the direction
  attribute doing the work rather than a second set of rules. Machine text —
  ports, PIDs, byte counts, paths, log lines — is bidi-isolated so `:3000`
  stays `:3000`.
- `npm run check`: fails on a locale with a typo'd key, a dropped
  `{placeholder}`, or one missing from the registry, and on a version mismatch
  between `package.json` and `Cargo.toml`. Runs in CI.

### Changed

- **Translations are one file per language** under `src/locales/`, with
  `src/locales/index.ts` as the only place that knows the list. Adding a
  language is a copy of `en.ts` plus one row. The tray's thirteen strings moved
  from a nested `match` to one flat table per language, with a test that no
  table can silently lose a key.
- `tauri.conf.json` reads its version from `package.json`, so the version now
  lives in two files instead of three.

## [0.1.1]

### Added

- Five languages — English, Türkçe, Español, Deutsch, 中文 — across the window
  and the native tray menu, picked from the toolbar and remembered. The locale
  is detected from the system on first run; missing keys fall back to English.
- **Start at login**, toggled from the toolbar. The OS login item is the only
  source of truth — nothing is mirrored in app storage.
- Open-source scaffolding: MIT license, contributing guide, code of conduct,
  security policy, issue and pull-request templates, CI, and a release workflow
  that bundles macOS, Linux and Windows from a tag.

### Changed

- **The tray menu no longer unrolls past the bottom of the screen.** One flat
  item per listening PID became four top-level items: ports and devices each
  live in a submenu, ports are grouped into the same process families the
  window shows, and a family with more than one process gets its own submenu
  with a *Kill all* entry. Long lists truncate at 30 families.

## [0.1.0]

- First release.
