# Security Policy

## Supported versions

The latest release is the supported one. Fixes land on `main` and ship in the
next tag.

## Reporting a vulnerability

Please do **not** open a public issue.

Use [GitHub's private vulnerability reporting](https://github.com/mustafasavul/portiye/security/advisories/new),
or email **mustafasavul44@gmail.com**.

Include what you can: the version, your platform, reproduction steps, and what
an attacker gains. Expect an acknowledgement within a week.

## Scope worth knowing about

portiye reads process and socket state and can terminate processes:

- It shells out to `lsof`, `netstat`, `adb`, `simctl`, `docker` and `ollama`.
  Anything that lets untrusted input reach one of those command lines is in
  scope.
- `kill_processes_elevated` asks the OS for elevation. Anything that widens
  what it targets is in scope.
- The window renders process names, command lines and paths from the machine.
  A rendering path that executes them is in scope.

Denial of service against your own machine — killing your own processes — is
what the app is for, and is not a vulnerability.
