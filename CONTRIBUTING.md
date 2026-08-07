# Contributing to portiye

Thanks for taking the time. Bug reports, translations and small focused pull
requests are all welcome.

## Getting set up

Prerequisites: [Rust](https://rustup.rs), Node 20+, and the
[Tauri system dependencies](https://tauri.app/start/prerequisites/).

```bash
npm install
npm run tauri dev
```

```bash
npm run build              # tsc + vite
cd src-tauri && cargo test
cd src-tauri && cargo fmt && cargo clippy
```

## Before you open a pull request

- **Run it in the real app.** `npm run dev` renders in Chromium; the app ships
  on WKWebView (macOS) and WebView2 (Windows). Behaviour has diverged before —
  `window.confirm` returns without showing anything in the Tauri webview, which
  is why `Confirm.tsx` exists. Never reach for `window.confirm` or
  `window.prompt`.
- **Add a test for logic, not for plumbing.** Parsers, diffing, family roots
  and CSV escaping have Rust tests. One runnable check that fails if the logic
  breaks is enough.
- **Keep the diff small.** One change per pull request.
- **Read [CLAUDE.md](CLAUDE.md)** — it records the decisions that already have
  an answer and the traps that already cost someone a day.

## Adding or fixing a translation

Two files, no build step:

- `src/i18n.tsx` — the window. Add your tag to `LOCALES`, copy the `en` block
  and translate. Any key you omit falls back to English.
- `src-tauri/src/i18n.rs` — the tray menu. Add your column to each `match` arm
  and to `KNOWN`.

Keep `{name}` placeholders intact and leave technical terms (PID, CPU, port
numbers) alone.

## Commit messages

Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`.

## Releasing (maintainers)

Bump the version in `package.json`, `src-tauri/Cargo.toml` and
`src-tauri/tauri.conf.json`, then push a tag:

```bash
git tag v0.2.0 && git push origin v0.2.0
```

`.github/workflows/release.yml` builds macOS, Linux and Windows bundles and
opens a draft release. Edit the notes, then publish.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
