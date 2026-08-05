/**
 * Which language runtime a process belongs to.
 *
 * Grouping by executable name alone never gathers a runtime: a Node project
 * shows up as `node`, `vite`, `esbuild`, `next-server` and `nodemon` all at
 * once, so a "node ×2" group never appears even when five Node processes are
 * running. These rules give the broad sweep — "kill everything Node" —
 * alongside the precise per-name groups.
 */
const RUNTIMES: { label: string; match: RegExp }[] = [
  {
    label: "Node.js",
    match:
      /^(node|nodejs|npm|npx|pnpm|yarn|bun|deno|ts-node|tsx|nodemon|vite|esbuild|next-server|next|webpack|rollup|turbo|nx|jest|vitest)$/i,
  },
  {
    label: "Python",
    match:
      /^(python[\d.]*|pypy[\d.]*|uvicorn|gunicorn|hypercorn|celery|flask|django|jupyter[-\w]*|streamlit|uv|poetry|pytest)$/i,
  },
  {
    label: "JVM",
    match:
      /^(java|javaw|kotlin|scala|gradle|GradleDaemon|KotlinCompileDaemon|mvn|maven|sbt)$/i,
  },
  { label: ".NET", match: /^(dotnet|mono|msbuild|omnisharp)$/i },
  { label: "Dart", match: /^(dart|dartaotruntime|flutter)$/i },
  { label: "Go", match: /^(go|gopls|air|dlv)$/i },
  { label: "Ruby", match: /^(ruby|rails|puma|unicorn|sidekiq|bundle)$/i },
  { label: "PHP", match: /^(php|php-fpm|artisan)$/i },
  { label: "Rust", match: /^(cargo|rustc|rust-analyzer)$/i },
];

/** The runtime label for a process name, or null when it is not one. */
export function runtimeOf(name: string): string | null {
  return RUNTIMES.find((r) => r.match.test(name))?.label ?? null;
}
