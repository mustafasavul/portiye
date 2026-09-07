# portiye

Tauri 2 + React 19 + TypeScript desktop app for developers: manage listening
ports, the processes behind them, and the emulators / simulators / containers
on the machine. Lives in the menu bar; the window is optional.

macOS is the daily driver, but every code path is written for macOS, Linux and
Windows.

## Run it

```bash
npm run tauri dev          # the real app (WKWebView on macOS)
npm run build              # tsc + vite
cd src-tauri && cargo test # 38 tests (36 on Windows — two need a unix fixture)
npm run check              # locale keys, placeholders, version triple
```

Vite alone (`npm run dev`) renders in Chromium — useful for fast UI work, but
**not** the engine the app ships on. See "Traps" below.

---

## Layout

### Rust — `src-tauri/src/`

| File | Owns |
|---|---|
| `watch.rs` | **The single poller.** Scans every 5s, diffs snapshots, keeps history, emits `ports-changed`. Everything else reads its cache. Also serves host CPU / RAM / disk off the same `System`. |
| `ports.rs` | `scan()` (lsof / netstat + sysinfo), the `detail_for` labels, family grouping, kill + elevation |
| `gpu.rs` | Whole-machine GPU load, one source per platform. `None` where there is none |
| `runtimes.rs` | Docker / Ollama / JVM daemons — same row shape as devices |
| `avd.rs`, `sim.rs` | Android emulators, iOS simulators |
| `procinfo.rs` | One process in depth (CPU, tree, lsof). On demand only |
| `logs.rs` | Device log streaming, one stream at a time |
| `export.rs` | JSON/CSV snapshot to `~/Downloads` |
| `tray.rs` | Menu-bar menu: a one-line load readout, ports + devices, actionable without the window |
| `i18n.rs` | The tray's thirteen strings in 28 languages. `set_locale` is pushed by the window |

### Frontend — `src/`

`App.tsx` orchestrates; panels live in `components/`. `types.ts` holds shared
shapes. `risk.ts` classifies dangerous kill targets, `runtime.ts` maps process
names to language runtimes. `Confirm.tsx` is the confirmation dialog — **use it,
never `window.confirm`**. `i18n.tsx` is the provider; the strings live one
file per language in `locales/`, listed only in `locales/index.ts`.

Three views (tabs): Ports · History · Device Logs — the last only on a machine
that has a simulator or emulator to stream.

---

## Decisions worth not re-litigating

**One poller, in Rust.** There used to be two 5-second loops (tray in Rust,
window in JS) scanning the same machine. Now `watch.rs` is the only one; the
window listens for `ports-changed`. This is also what makes CPU% real —
`System::new_all()` per call always reports 0, sysinfo needs two samples of the
same instance.

**Ports refresh ≠ device refresh.** `simctl list` costs ~0.8s and `docker ps`
~0.2s. Running them on the port tick meant burning a fifth of every 5 seconds
on subprocesses, which is what made tab switches stutter. Ports refresh on
every event (a cached read, free); devices refresh every 30s and after any
device action.

**Storage is `localStorage`** via `hooks/usePersisted.ts` — sweeps, profiles,
saved filters, thresholds. Deliberate: a Rust + serde + fs layer buys nothing
here. Move it to a file only if these need to be hand-edited or synced.

**Auto-kill is a saved *sweep*, not a background rule.** It matches on demand
and always shows the confirmation. Nothing is ever killed silently.

**Nothing on the main thread may shell out.** The tray menu is rebuilt on
every port tick, on the main thread (macOS requires it), and it used to call
`list_avds` + `list_simulators` while it was there — `simctl list` is ~0.8s, so
the menu bar froze for a fifth of every five seconds. Device rows are now
scanned on their own 30s thread into a cache that `build_menu` only reads. The
rebuild itself stays every tick: it is microseconds, and it keeps the memory
figures in the submenu honest.

**Disk is read once a minute, not once a tick.** `Disks::new_with_refreshed_list()`
costs ~20ms on APFS — four times the whole process refresh beside it — and free
space does not move in five seconds. `watch::disk_usage` repeats the last
reading in between; switching the setting off drops the cache rather than
replaying it later.

**The tray is four items tall, not one per PID.** A flat item per listening
process unrolled the menu past the bottom of the screen on any machine with a
few dev servers up. Ports and devices each live in a submenu; ports group into
the same families the window shows, and a family with more than one process
gets a nested submenu with a *Kill all* entry. Truncates at 30 families.

**i18n is a dict and one `t()`**, not i18next. `src/locales/` for the window
(one file per language, registry in `index.ts`), `src-tauri/src/i18n.rs` for
the tray — the tray is native and cannot reach the webview's table, so the
window pushes the locale over `set_locale` and the menu is rebuilt. English is
the fallback for any missing key, so a partial translation still ships a
working app. `risk.ts` returns *keys*, not prose, so warnings translate at the
point they are shown. `scripts/check.mjs` catches the two things tsc cannot:
a typo'd key and a dropped `{placeholder}`.

**Locale files are imported statically**, all 28 of them. Measured: 257 KB of
the 504 KB bundle, 70 KB gzipped — over half of it, and still nothing for an
app that loads off local disk, where the language switch has no loading state.
Reach for `import()` only if the count doubles.

**No CSS framework.** Tailwind was in the build for its preflight and nothing
else — zero utility classes, no `@apply`, no theme — so it was a plugin, two
dependencies and 6.5 KB of CSS for a reset, and the reason `<dialog>` would not
centre. `index.css` now opens with the twenty lines it actually leaned on:
`box-sizing`, zeroed heading/paragraph/list margins, `font: inherit` on form
controls, bare buttons, `display: block` on svg. Verified at 320 and 1280 px,
including the confirm dialog's centring.

**RTL is logical properties, not a mirrored stylesheet.** `dir="rtl"` on the
root, and `margin-inline-start` / `text-align: end` / `inset-inline-end`
everywhere. `left` and `right` do not belong in `index.css` — the two
exceptions are the detail panel's drop shadow, which points somewhere, and the
numeric columns whose alignment is fixed up under `[dir="rtl"]`. Machine text
(ports, PIDs, paths, log lines) carries `direction: ltr; unicode-bidi: isolate`
or bidi renders `:3000` as `3000:`.

**`document.documentElement.lang` follows the locale.** Not decoration: CSS
`text-transform: uppercase` is locale-aware, and Turkish "i" only uppercases to
"İ" when the document says it is Turkish.

**Start at login has no state of its own.** `tauri-plugin-autostart` writes a
LaunchAgent / registry key / .desktop file, and that file *is* the truth. A
mirror in `localStorage` would only be a second source to disagree with it.

**Devices, runtimes, containers share one row component.** They all have the
same shape: name, platform, meta, running, start/stop, destructive action.

**History is in memory** (500-event ring). Session-scoped is enough; the app
runs for days. Upgrade path noted in `watch.rs`.

**System load is host-wide, not per device.** The gauges between Devices and
Listening Ports read the whole machine. There is no honest per-device number to
show: iOS simulators are not isolated processes at all, and an Android emulator
is a QEMU process whose host-side CPU is not the guest's. Only runtimes (JVM
daemons, Docker containers) map to something real — that is the row to extend
if per-item stats are ever wanted, not the emulator rows. `get_system_stats`
reads the poller's own `System`, because a fresh `System::new_all()` always
reports 0% CPU. Disks are enumerated per call instead: a `statfs` per mount is
cheap, unlike the `simctl`/`docker` subprocesses that forced the device split.

**A lister returns an empty list, never `Err`, when its toolchain is absent.**
No Xcode, no Android SDK, no Docker — that is not a fault, it is a machine.
`Err` is for a tool that is *there* and failed. This is a contract, not a
style: the window fetches all three lists together, so one lister that rejects
used to blank the other two panels and raise a banner every 30 seconds. Actions
may still fail loudly — `boot_simulator` on a box without `xcrun` is a real
error, because you had to see a device to click it.

**Anything a platform cannot show is removed, not zeroed.** GPU with no
readable counter, disk with no fixed volume, the `lsof` sections on Windows,
the Device Logs tab on a machine with neither Xcode nor the Android SDK, the
elevated-retry button on a Linux box without polkit. A zero, an empty picker
or a button that can only fail all read as "broken app" rather than "not
applicable here". `elevation_hint()` returning `""` is how the window learns
it must not offer the retry.

**A missing gauge beats a made-up one.** GPU is `Option<f32>` and the row is
hidden when it is `None`. macOS reads `ioreg -c IOAccelerator` (~15ms, no
sudo); Linux reads `gpu_busy_percent` out of sysfs and falls back to
`nvidia-smi`; Windows has only `nvidia-smi`, because the generic "GPU Engine"
counters need aggregating across every engine and process before they mean
anything. Same rule for disk: no fixed volume, no row.

---

## Traps — each of these cost real debugging time

**`Promise.all` over three unrelated toolchains is a blackout waiting to
happen.** `list_avds` / `list_simulators` / `list_runtimes` enumerate Android,
Xcode and Docker; most machines have some of them. Under `all`, one rejection
threw away the two results that *did* arrive. It is `allSettled`, and each
list is set independently. Same shape anywhere else that fans out over
optional tools.

**`sysinfo::used_memory()` is `total - free`, and it barely moves.** macOS keeps
almost nothing free — it lends the rest out as cache — so `free` sits near
0.1 GB and the "used" figure is pinned near the total: 13.5 of 16 GB on an idle
machine, a permanent 85% that never twitches. The gauge looked frozen because
it was. Use `total - available_memory()`, which counts reclaimable cache as
free: it answers "how much room is left" and it actually moves.

**A Tauri event per line is a React render per line.** Device logs arrive one
`log-line` event at a time, each in its own task, so React batches none of
them: `logcat` on a busy device meant hundreds of renders a second, each
reconciling up to 2000 rows and copying the whole array. Lines land in a ref
and flush on a 100ms interval. Any other firehose event needs the same shape.

**`window.confirm` and `window.prompt` do nothing in the Tauri webview.** They
return without showing a panel, so every guarded action silently no-ops. This
broke Fast Kill, Wipe and Erase at once. Use `useConfirm()` from
`Confirm.tsx`; build inline forms instead of `prompt`.

**Chromium preview ≠ WKWebView.** Behaviour verified in `npm run dev` can still
fail in the real app. `setPointerCapture` and `preventDefault` on `pointerdown`
both behaved differently. Smoke-test in `npm run tauri dev` before calling
something done.

**Tailwind preflight zeroes `<dialog>`'s margin,** which pins a modal to the
top-left. Centre it explicitly.

**React props in event handlers go stale under key-repeat.** Pass updater
functions (`prev => prev + step`), not computed values.

**Two kill tests are `#[cfg(unix)]`**, not because `kill_processes` differs by
platform — it walks the same `children_map` everywhere — but because their
fixtures are `sleep` and `sh -c`, which Windows does not have. Gate the
fixture, never the behaviour.

**`#[cfg]` blocks are where `-D warnings` bites.** A value computed once and
used by only one platform's branch is an unused variable on the other two, and
CI fails on a machine that compiles clean here. Build each branch's arguments
inside that branch. Check the Windows target locally before pushing — see
"Known gaps" for the one-liner.

**Collect before you decide.** Family grouping originally picked the root while
iterating, so any member arriving before the root was silently dropped. Gather
members, then choose.

**Global state plus parallel tests is a coin flip, not a test.** `i18n::LOCALE`
is one process-wide `Mutex<Table>`, and `cargo test` runs test functions on
their own threads: two tests that both called `set()` had one's `set("en")`
landing between the other's `set("zh_Hans_CN")` and the assertion after it.
It failed 45 times in 300 runs at `--test-threads=8` — which is to say it was
broken for months and CI kept winning the toss, then lost it on an unrelated
commit. A test-only `Mutex` taken by both is the fix; do not reshape the real
code to suit the test, and recover poisoning with `into_inner()` so one genuine
failure does not turn its neighbour into a second, confusing one. Anything else
reaching for a `static` needs the same guard.

**A restart is not a port conflict.** Same process name reclaiming its own port
is normal; only a *different* process taking it within 30s is recorded as a
`"taken"` event. There is no OS notification — the History tab is the whole
surface.

---

## How this project verifies things

The established pattern, and it catches real bugs:

1. **Stub the Tauri bridge in the Vite preview** — set
   `window.__TAURI_INTERNALS__.invoke` to return fixtures, then drive the UI
   with real events and assert on the DOM.
2. **Sabotage `window.confirm` to return `undefined`** in that stub. It mimics
   the Tauri webview; if the app still depends on it, nothing happens.
3. **Assert the destructive paths**: cancel / Esc / backdrop must produce
   **zero** command calls; confirm must send exactly the expected PIDs.
4. **Then the real Tauri window.** Chromium is not the shipping engine.
5. **Rust tests for pure logic** — parsers, snapshot diffing, family roots, CSV
   escaping. `kill_processes` is tested against a `sleep` child we spawned.
6. **`scripts/risk.test.mjs` for the kill warnings.** The one piece of frontend
   logic whose regression costs data rather than pixels: drop a row from
   `RULES` and `postgres` silently gets the same dialog as a stray `node`.
   Node imports `src/risk.ts` directly by stripping the types — no runner, no
   dependency, and no second copy of the table to drift. That is what pins the
   floor to Node 22.18; `npm run check` runs it, so CI already does.
7. **320 / 768 / 1180 px, light and dark.** `scrollWidth === clientWidth`.

---

## Known gaps

- The tray's device entries were verified by test, not by eye.
- Measured on one Mac (488 processes): `lsof` 35ms, `refresh_all` 5.4ms,
  volumes 20ms, `ioreg` 19.5ms, `simctl list` 778ms. Narrowing `refresh_all`
  to a `RefreshKind` saves ~1ms and was **not** worth the noise — the win was
  in what runs at all, not in how it is asked for.
- GitHub Actions runs `npm run build`, `cargo fmt --check`, `cargo clippy -D
  warnings` and `cargo test` on macOS, Linux and Windows. Nothing runs the UI.
- **Windows can be checked locally after all.** The `llvm-rc` that
  `tauri-winres` panics without ships with Homebrew's `llvm`:

  ```bash
  PATH="/opt/homebrew/opt/llvm/bin:$PATH" cargo clippy --target x86_64-pc-windows-msvc --all-targets -- -D warnings
  ```

  Worth running before pushing anything with a `#[cfg]` in it — that is what
  caught the two lints that turned CI red. Linux still needs GTK dev headers
  (`gdk-sys` and friends fail in their build scripts), so CI is the only full
  Linux check. Neither platform has been observed by eye.

  A `#[cfg(target_os = "linux")]` block that only touches `std` can still be
  syntax- and lint-checked here without GTK, by pasting it into a standalone
  file and compiling that for the target:

  ```bash
  rustc --target x86_64-unknown-linux-gnu --edition 2021 --emit=metadata \
        -o /tmp/probe.rmeta -D warnings /tmp/linuxprobe.rs
  ```

- The tray's submenu grouping and its load readout were verified by unit test
  and by launching the real app without a panic — the menu itself has not been
  read by eye.
- The 28 translations were written in one pass and have had no native review
  beyond Turkish and English. Corrections are the easiest contribution to make.
- RTL was verified in the Vite harness (Arabic, mirrored layout, no horizontal
  scroll) but not yet in the real WKWebView window.
