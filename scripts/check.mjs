#!/usr/bin/env node
/**
 * Two things a compiler cannot catch, checked with no dependencies:
 *
 * 1. **Translations.** `Strings` is a `Partial`, so a missing key is legal —
 *    that is the point, English fills the gap. What is *not* legal is a typo'd
 *    key (dead string, silent English forever) or a lost `{placeholder}`,
 *    which turns "Kill 3 node processes?" into a sentence with a hole in it.
 * 2. **Version.** Three files carry it and they must agree.
 *
 * ponytail: regex over the source, not a TypeScript loader. The locale files
 * are flat object literals; teaching Node to import TS costs more than this.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const localeDir = join(root, "src/locales");
let failed = false;

const fail = (msg) => {
  console.error(`✗ ${msg}`);
  failed = true;
};

// ── Translations ────────────────────────────────────────────────────────────

/** `"key": "value"` pairs, including the ones wrapped onto the next line. */
function entries(source) {
  const out = new Map();
  const re = /^\s{2}"([\w.]+)":\s*\n?\s*((?:"(?:[^"\\]|\\.)*"\s*\n?\s*)+),$/gm;
  for (const [, key, raw] of source.matchAll(re)) out.set(key, raw);
  return out;
}

const placeholders = (value) =>
  new Set([...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));

const english = entries(readFileSync(join(localeDir, "en.ts"), "utf8"));
if (english.size < 50) fail(`only parsed ${english.size} keys out of en.ts`);

const files = readdirSync(localeDir)
  .filter((f) => f.endsWith(".ts") && f !== "en.ts" && f !== "index.ts")
  .sort();

const registry = readFileSync(join(localeDir, "index.ts"), "utf8");
const report = [];

for (const file of files) {
  const tag = file.replace(/\.ts$/, "");
  const found = entries(readFileSync(join(localeDir, file), "utf8"));

  if (!new RegExp(`^  ${tag}: \\{`, "m").test(registry))
    fail(`${file} is not listed in locales/index.ts`);

  for (const [key, value] of found) {
    if (!english.has(key)) {
      fail(`${file}: "${key}" does not exist in en.ts`);
      continue;
    }
    const want = placeholders(english.get(key));
    const got = placeholders(value);
    for (const p of want)
      if (!got.has(p)) fail(`${file}: "${key}" lost the {${p}} placeholder`);
    for (const p of got)
      if (!want.has(p)) fail(`${file}: "${key}" invented a {${p}} placeholder`);
  }

  const missing = english.size - found.size;
  report.push(
    `  ${tag.padEnd(4)} ${String(found.size).padStart(3)}/${english.size}` +
      (missing > 0 ? `  (${missing} fall back to English)` : ""),
  );
}

console.log(`${files.length + 1} locales, ${english.size} keys each:`);
console.log(report.join("\n"));

// ── Version ─────────────────────────────────────────────────────────────────

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const cargo = readFileSync(join(root, "src-tauri/Cargo.toml"), "utf8");
const conf = JSON.parse(readFileSync(join(root, "src-tauri/tauri.conf.json"), "utf8"));

const cargoVersion = cargo.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
if (cargoVersion !== pkg.version)
  fail(`Cargo.toml is ${cargoVersion}, package.json is ${pkg.version}`);

// Tauri reads the version straight out of package.json when pointed at it, so
// there is no third copy to drift.
if (conf.version !== "../package.json")
  fail(`tauri.conf.json should set "version": "../package.json"`);

console.log(`version ${pkg.version} — package.json, Cargo.toml, tauri.conf.json agree`);

process.exit(failed ? 1 : 0);
