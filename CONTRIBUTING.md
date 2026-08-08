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
npm run check              # locale keys, placeholders, version
cd src-tauri && cargo test
cd src-tauri && cargo fmt && cargo clippy --all-targets -- -D warnings
```

Touching anything inside a `#[cfg(target_os = ...)]` block? Check the Windows
target too — CI compiles all three, and a variable that only one platform's
branch uses is an unused variable on the others, which `-D warnings` turns
into a red build. Homebrew's `llvm` ships the `llvm-rc` this needs:

```bash
PATH="/opt/homebrew/opt/llvm/bin:$PATH" cargo clippy --target x86_64-pc-windows-msvc --all-targets -- -D warnings
```

Linux cannot be checked from macOS — the GTK `-sys` build scripts want dev
headers — so CI is the only Linux check.

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

No build step:

- `src/locales/<tag>.ts` — the window. Copy `en.ts`, translate the values, and
  add one row to `src/locales/index.ts`. Any key you omit falls back to
  English, so a partial translation is welcome.
- `src-tauri/src/i18n.rs` — the thirteen strings in the menu-bar menu. Add one
  table for your language and one row to `LOCALES`.

Set `rtl: true` on the registry row for a right-to-left language. Style with
logical properties (`margin-inline-start`, `text-align: end`) so the layout
keeps mirroring itself; `left` and `right` do not belong in this stylesheet.

Keep `{name}` placeholders intact and leave technical terms (PID, CPU, port
numbers) alone. Then:

```bash
npm run check
```

It fails on a typo'd key, a dropped placeholder, or a language missing from
the registry, and prints per-language coverage.

## Commit messages

Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`.

## Releasing (maintainers)

Version lives in two files: `package.json` and `src-tauri/Cargo.toml`.
`tauri.conf.json` reads it out of `package.json`, and `npm run check` fails if
the two disagree. Bump both, then push a matching tag:

```bash
git tag v0.2.0 && git push origin v0.2.0
```

`.github/workflows/release.yml` builds macOS, Linux and Windows bundles and
opens a draft release. Edit the notes, then publish.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
