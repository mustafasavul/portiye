# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **A test for the kill warnings.** `src/risk.ts` decides whether killing
  `postgres`, an IDE or an OS service gets an explicit warning first, and
  nothing checked that it still did — the Rust suite is all backend and there
  is no browser runner here. `scripts/risk.test.mjs` asserts all five rule
  families still match, that ordinary dev processes still do not, and that
  every warning key exists in `en.ts`, where a typo would print the raw key
  into the dialog. It runs inside `npm run check`, so CI runs it.

### Changed

- Node 24 in CI, and `engines` set to `>=22.18`: the new test imports the
  TypeScript directly rather than keeping a second copy of the rule table, and
  type stripping landed in 22.18.
- CI actions moved off the Node 20 runtime GitHub is retiring:
  `actions/checkout` and `actions/setup-node` to v7, `tauri-action` to v1.

### Fixed

- A flaky i18n test. Two tests moved the same process-wide locale slot while
  `cargo test` ran them in parallel, so one's `set("en")` could land between
  the other's `set` and its assertion — reproduced at roughly one run in seven,
  and it turned CI red on an unrelated commit.

## [0.5.2]

### Added

- **An icon of its own.** The app shipped with Tauri's default logo in the
  Dock, the DMG, the taskbar and the menu bar. It now carries the wordmark's
  own mark — a Space Grotesk `p` and the accent dot — as a plate for the
  desktop and, separately, as a flat monochrome template for the macOS menu
  bar, which keeps only the alpha channel and would have rendered the plate
  as a filled square.
- Screenshots in the README, and the wordmark as SVG in both themes.

## [0.5.1]

### Fixed

- **The `.rpm` installed without `lsof`.** Only the `.deb` declared the
  dependency, and Linux's scan has no fallback — so on Fedora and RHEL the
  port list came back empty with no explanation. The `.rpm` now declares it
  too.
- **`@tauri-apps/plugin-notification` was a dependency that did nothing**: no
  Rust plugin, no capability grant, no call site. Removed.

### Changed

- **Install docs now match the platforms.** macOS 15 dropped the
  right-click → Open path, so Privacy & Security → Open Anyway is documented
  beside it; Windows' SmartScreen prompt and the `-setup.exe` filename were
  undocumented; and the `.AppImage` cannot declare dependencies, so it now
  says to install `lsof` first. Why the builds are unsigned is stated outright
  rather than left as a footnote.
- `harness.html`, the stubbed-bridge verification page, is documented in
  CONTRIBUTING instead of sitting unexplained in the repository root.
- The window carried Vite's scaffolding title and favicon.
- **The `.dmg` no longer opens with a licence agreement.** `licenseFile`
  turned MIT into a click-through EULA that had to be accepted before the
  disk image would even mount — two dialogs deep before reaching the app, on
  a permissive licence that already ships inside the bundle and the
  repository.

## [0.5.0]

### Added

- **A Settings view**, the fourth tab. Everything that is set once and left
  alone moved here — the memory threshold, the export format, start at login —
  and the panels that can be switched off carry a gear in their heading that
  opens it, so "how do I hide this?" is answered where the question is asked.
- **Switches for every gauge and column**: CPU, GPU, memory, disk, the Devices
  panel and the System panel. Off means off, not painted white on white:

  - GPU off and nothing measures it — no `ioreg` on the poll tick, no
    `nvidia-smi` sampler, and a streaming sampler ends its own child process.
  - Disk off and the volume list is never enumerated.
  - Devices off and `emulator`, `adb`, `simctl` and `docker` are never run.
    The Device Logs tab goes with them, because its picker is those lists.

- **Menu-bar controls.** The icon can be hidden, and its load readout, ports
  submenu and devices submenu each switched off. With the icon hidden, closing
  the window quits portiye rather than hiding it — the alternative is a running
  app with no way back to it.
- **A Related toggle** over the port table. On, a process nests under whatever
  started it; off, every process gets its own row. Nothing is hidden either
  way.
- **Copy on the LAN address.** It exists to be typed into a phone, and typing
  four numbers off a screen is the part that goes wrong.
- **Port history reads like a table**: labelled columns, a filter over port,
  process and path, and event-type buttons carrying their counts, so `616` is
  identifiable as a PID without being told.
- **A Help menu** with the repository, the issue tracker and the release notes,
  in all 28 languages.
- **The version**, in Settings → About.

### Fixed

- **Start at login failed silently.** Writing the login item can be refused;
  the switch simply flipped back, which read as a broken toggle. The error is
  now shown, and the state is read back from the OS rather than assumed.
- **Sorting by a hidden column** left the table in what looked like a random
  order. The sort falls back to port when its column goes away.

### Changed

- **The tray no longer scans devices on the main thread.** `build_menu` ran
  `simctl list` — measured at 778ms — inside `run_on_main_thread`, every five
  seconds: the menu bar was blocked for a sixth of its life. Device rows are
  scanned on their own 30-second thread into a cache the menu only reads.
- **The disk is measured once a minute**, not once a tick. Enumerating volumes
  costs ~20ms on APFS, four times the whole process refresh beside it, and free
  space does not move in five seconds.
- **A tray family kill is one scan.** Each `kill_process` built its own
  `System`, so a five-process family paid for five full scans of the machine.
- **The kill paths, the JVM daemon sweep and the process detail panel** ask for
  the process fields they read instead of everything sysinfo can collect, and
  `descendants` walks a set rather than re-scanning a Vec per child.
- **Device logs are batched.** Each `log-line` event lands in its own task, so
  React batched none of them: `logcat` on a busy device meant hundreds of
  renders a second over 2000 rows. Lines flush on a 100ms interval.
- **Tailwind is gone.** It was in the build for its preflight and nothing else
  — no utility class, no `@apply`, no theme — and it was what kept `<dialog>`
  from centring. Twenty lines of reset replace it; the stylesheet is 6.5 KB
  smaller and two dependencies lighter.

## [0.4.0]

### Added

- **The address other devices can reach.** The machine's LAN address is stated
  once in the toolbar (`LAN IP 192.168.1.126`), and every port bound past
  loopback carries a chip with the full `ip:port` under its process. That is
  the address you type into a phone to test a dev server on a real device — a
  port bound to `127.0.0.1` gets no chip, because a phone cannot reach it.
  Clicking a chip opens it in the default browser.
- **The port number is a link.** `:4321` opens `http://localhost:4321`, the
  same address the dev server printed in your terminal.
- **CPU and disk columns**, both sortable. Disk is bytes per second read plus
  written over the tick that just ended, and idle reads as a dash rather than
  `0 KB/s`.
- **Per-process GPU on NVIDIA machines** — the number that matters when a model
  is resident. `nvidia-smi pmon` is the only per-process source, and one
  invocation costs a whole sample interval, so it is started once and left
  streaming: a long-lived child printing a block every five seconds, read as it
  arrives, at no cost to the poll loop. Where `pmon` is not a subcommand
  (Windows) it falls back to `--query-compute-apps`, which reports video memory
  but no SM share. The column exists only where something is reporting.
- **Devices group by platform.** Ten devices in one grid is a pile; Apple's sit
  together, Android's sit together, and the panel scrolls at 40vh instead of
  growing until the port table has nowhere left to go. A machine with a single
  platform sees no subhead — it would only repeat the panel title.

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
