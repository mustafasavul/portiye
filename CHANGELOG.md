# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
