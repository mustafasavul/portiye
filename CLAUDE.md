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
cd src-tauri && cargo test # 25 tests (23 on Windows — two need a unix fixture)
npm run check              # locale keys, placeholders, version triple
```

Vite alone (`npm run dev`) renders in Chromium — useful for fast UI work, but
**not** the engine the app ships on. See "Traps" below.

---

## Layout

### Rust — `src-tauri/src/`

| File | Owns |
|---|---|
| `watch.rs` | **The single poller.** Scans every 5s, diffs snapshots, keeps history, fires notifications, emits `ports-changed`. Everything else reads its cache. |
| `ports.rs` | `scan()` (lsof / netstat + sysinfo), the `detail_for` labels, family grouping, kill + elevation |
| `runtimes.rs` | Docker / Ollama / JVM daemons — same row shape as devices |
| `avd.rs`, `sim.rs` | Android emulators, iOS simulators |
| `procinfo.rs` | One process in depth (CPU, tree, lsof). On demand only |
| `logs.rs` | Device log streaming, one stream at a time |
| `export.rs` | JSON/CSV snapshot to `~/Downloads` |
| `tray.rs` | Menu-bar menu: ports + devices, actionable without the window |
| `i18n.rs` | The tray's thirteen strings in 28 languages. `set_locale` is pushed by the window |

### Frontend — `src/`

`App.tsx` orchestrates; panels live in `components/`. `types.ts` holds shared
shapes. `risk.ts` classifies dangerous kill targets, `runtime.ts` maps process
names to language runtimes. `Confirm.tsx` is the confirmation dialog — **use it,
never `window.confirm`**. `i18n.tsx` is the provider; the strings live one
file per language in `locales/`, listed only in `locales/index.ts`.

Three views (tabs): Ports · History · Device Logs.

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

**Locale files are imported statically**, all 28 of them. That is ~160 KB of
the bundle; the app loads off local disk and the language switch has no
loading state. Reach for `import()` only if the count doubles.

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

---

## Traps — each of these cost real debugging time

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

**A restart is not a port conflict.** Same process name reclaiming its own port
is normal; only a *different* process taking it within 30s is an event worth a
notification.

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
6. **320 / 768 / 1180 px, light and dark.** `scrollWidth === clientWidth`.

---

## Known gaps

- The tray's device entries were verified by test, not by eye.
- Notifications need a real takeover or a crossed threshold to observe; not yet
  seen firing in anger.
- GitHub Actions runs `npm run build`, `cargo fmt --check`, `cargo clippy -D
  warnings` and `cargo test` on macOS, Linux and Windows. Nothing runs the UI.
- **Windows can be checked locally after all.** The `llvm-rc` that
  `tauri-winres` panics without ships with Homebrew's `llvm`:

  ```bash
  PATH="/opt/homebrew/opt/llvm/bin:$PATH" cargo clippy --target x86_64-pc-windows-msvc --all-targets -- -D warnings
  ```

  Worth running before pushing anything with a `#[cfg]` in it — that is what
  caught the two lints that turned CI red. Linux still needs GTK dev headers
  (`gdk-sys` and friends fail in their build scripts), so CI is the only Linux
  check. Neither platform has been observed by eye.
- The tray's new submenu grouping was verified by unit test and by launching
  the real app without a panic — the menu itself has not been read by eye.
- The 28 translations were written in one pass and have had no native review
  beyond Turkish and English. Corrections are the easiest contribution to make.
- RTL was verified in the Vite harness (Arabic, mirrored layout, no horizontal
  scroll) but not yet in the real WKWebView window.
