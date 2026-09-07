#!/usr/bin/env node
/**
 * Guards `src/risk.ts` — the table that decides whether killing something gets
 * a warning first.
 *
 * This is the one place in the frontend where a silent regression costs data
 * rather than pixels: drop a row from `RULES` and the confirmation for
 * `postgres` quietly becomes the same dialog as the one for a stray `node`.
 * Nothing else in the repository would notice. `cargo test` is all backend, and
 * there is no browser test runner here on purpose.
 *
 * ponytail: no framework, no dependency. Node runs the TypeScript directly, so
 * this stays in step with the source instead of a copy of it.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { warningFor } from "../src/risk.ts";

let failed = 0;
const check = (label, fn) => {
  try {
    fn();
  } catch (e) {
    failed++;
    console.error(`✗ ${label}\n  ${e.message.split("\n")[0]}`);
  }
};

// Process names as `lsof` and `sysinfo` actually report them.
const DANGEROUS = [
  ["postgres", "risk.database"],
  ["postgresql", "risk.database"],
  ["mysql", "risk.database"],
  ["mysqld", "risk.database"],
  ["mariadbd", "risk.database"],
  ["mongod", "risk.database"],
  ["redis-server", "risk.database"],
  ["memcached", "risk.database"],
  ["elasticsearch", "risk.database"],
  ["rabbitmq-server", "risk.database"],
  ["clickhouse-server", "risk.database"],

  ["Electron", "risk.editor"],
  ["Code Helper (Renderer)", "risk.editor"],
  ["Cursor", "risk.editor"],
  ["Antigravity IDE Helper (Plugin)", "risk.editor"],
  ["idea", "risk.editor"],
  ["webstorm", "risk.editor"],
  ["pycharm", "risk.editor"],
  ["sublime_text", "risk.editor"],
  ["zed", "risk.editor"],

  ["launchd", "risk.system"],
  ["systemd", "risk.system"],
  ["WindowServer", "risk.system"],
  ["mDNSResponder", "risk.system"],
  ["sshd", "risk.system"],
  ["svchost.exe", "risk.system"],
  ["lsass.exe", "risk.system"],

  ["docker", "risk.container"],
  ["docker-compose", "risk.container"],
  ["com.docker.backend", "risk.container"],
  ["containerd", "risk.container"],
  ["colima", "risk.container"],
  ["podman", "risk.container"],
  ["qemu-system-x86_64", "risk.container"],
  ["VBoxHeadless", "risk.container"],

  ["emulator", "risk.device"],
  ["adb", "risk.device"],
  ["netsimd", "risk.device"],
  ["Simulator", "risk.device"],
];

for (const [name, key] of DANGEROUS) {
  check(`${name} warns`, () =>
    assert.equal(warningFor(name), key, `${name} should warn with ${key}`),
  );
}

// The processes Fast Kill exists to clear. A warning on every one of these
// would train people to click through the dialog without reading it, which is
// the failure mode the warning is there to prevent.
for (const name of [
  "node",
  "python3",
  "java",
  "ruby",
  "php-fpm",
  "dotnet",
  "dart",
  "deno",
  "bun",
  "vite",
  "next-server",
  "gunicorn",
]) {
  check(`${name} is ordinary`, () =>
    assert.equal(warningFor(name), null, `${name} should not warn`),
  );
}

check("matching ignores case", () => {
  assert.equal(warningFor("POSTGRES"), "risk.database");
  assert.equal(warningFor("Redis-Server"), "risk.database");
});

// Anchored at the start on purpose: a project of your own that merely mentions
// a database in its name is not a database.
check("matching is anchored to the start of the name", () => {
  assert.equal(warningFor("my-postgres-proxy"), null);
  assert.equal(warningFor("run-docker-build"), null);
});

// A key with a typo is worse than a missing warning: `t()` falls through to the
// raw key, so the dialog would show the literal text "risk.databse".
check("every warning key exists in en.ts", () => {
  const en = readFileSync(new URL("../src/locales/en.ts", import.meta.url), "utf8");
  for (const key of new Set(DANGEROUS.map(([, k]) => k)))
    assert.ok(en.includes(`"${key}":`), `${key} is missing from en.ts`);
});

if (failed) {
  console.error(`\n${failed} risk check(s) failed`);
  process.exit(1);
}
console.log(
  `risk rules ${DANGEROUS.length} dangerous, 12 ordinary, anchoring and keys — all pass`,
);
