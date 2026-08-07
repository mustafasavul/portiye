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
cd src-tauri && cargo test # 19 tests
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

### Frontend — `src/`

`App.tsx` orchestrates; panels live in `components/`. `types.ts` holds shared
shapes. `risk.ts` classifies dangerous kill targets, `runtime.ts` maps process
names to language runtimes. `Confirm.tsx` is the confirmation dialog — **use it,
never `window.confirm`**.

Four views (tabs): Ports · Automation (sweeps + profiles) · History · Logs.

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
- No CI. Tests are run by hand.
- Windows and Linux have never been compiled — `llvm-rc` is missing locally, so
  cross-target checks fail for environment reasons, not code reasons. The
  platform-specific paths were reviewed by hand only.
