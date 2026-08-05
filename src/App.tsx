import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTheme } from "./theme";
import {
  CloseIcon,
  MoonIcon,
  RefreshIcon,
  SortArrowIcon,
  SunIcon,
} from "./icons";

type PortEntry = {
  pid: number;
  port: number;
  name: string;
  detail: string;
  memory: number;
  family: number;
};

/** One process, with every port it holds. */
type Proc = {
  pid: number;
  name: string;
  detail: string;
  memory: number;
  ports: number[];
};

/** A process and its listening descendants — `emulator` + the `qemu` it spawned. */
type Family = { root: Proc; children: Proc[] };
type Avd = { name: string; serial: string | null };
type Simulator = { udid: string; name: string; state: string; runtime: string };

/** Docker containers, Ollama models, JVM build daemons — whatever is present. */
type RuntimeItem = {
  id: string;
  kind: string;
  name: string;
  meta: string;
  running: boolean;
  can_start: boolean;
  can_stop: boolean;
  can_remove: boolean;
};

/**
 * Emulators, simulators, containers, models and build daemons all carry the
 * same shape — a name, a platform label, one line of meta, a running flag, a
 * start/stop action and sometimes a destructive one. One row type renders all
 * of them; an action the source cannot perform is simply null.
 */
type Device = {
  id: string;
  name: string;
  platform: string;
  meta: string;
  running: boolean;
  toggleLabel: string;
  toggle: (() => Promise<void>) | null;
  reset: (() => Promise<void>) | null;
  resetLabel: string;
  resetWarning: string;
};

type SortKey = "port" | "name" | "memory" | "pid";
type Sort = { key: SortKey; dir: 1 | -1 };

/** Memory reads descending — you open it to find the biggest hog. */
const defaultDir = (key: SortKey): 1 | -1 => (key === "memory" ? -1 : 1);

const mb = (bytes: number) =>
  bytes >= 1_073_741_824
    ? `${(bytes / 1_073_741_824).toFixed(1)} GB`
    : `${Math.round(bytes / 1_048_576)} MB`;

export default function App() {
  const [theme, setTheme] = useTheme();
  const [avds, setAvds] = useState<Avd[]>([]);
  const [sims, setSims] = useState<Simulator[]>([]);
  const [runtimes, setRuntimes] = useState<RuntimeItem[]>([]);
  const [ports, setPorts] = useState<PortEntry[]>([]);
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<Sort>({ key: "port", dir: 1 });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const filterRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const [a, s, p, r] = await Promise.all([
        invoke<Avd[]>("list_avds"),
        invoke<Simulator[]>("list_simulators"),
        invoke<PortEntry[]>("get_listening_ports"),
        invoke<RuntimeItem[]>("list_runtimes"),
      ]);
      setAvds(a);
      setSims(s);
      setPorts(p);
      setRuntimes(r);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  // ⌘K / ⌘F both jump to the filter — the one keyboard move a dev expects.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "f")) {
        e.preventDefault();
        filterRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /** Runs an action with a busy lock, surfacing failures in the banner. */
  const run = async (id: string, action: () => Promise<void>) => {
    setBusy(id);
    try {
      await action();
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  const devices: Device[] = useMemo(() => {
    const android: Device[] = avds.map((a) => ({
      id: `avd:${a.name}`,
      name: a.name.replace(/_/g, " "),
      platform: "Android",
      meta: a.serial ?? "emulator",
      running: a.serial !== null,
      toggleLabel: a.serial ? "Stop" : "Launch",
      resetLabel: "Wipe",
      resetWarning:
        "All apps, data and snapshots are erased, then it cold boots.",
      toggle: () =>
        a.serial
          ? invoke("stop_avd", { serial: a.serial })
          : invoke("launch_avd", { name: a.name }),
      reset: () => invoke("wipe_avd", { name: a.name, serial: a.serial }),
    }));

    const ios: Device[] = sims.map((s) => ({
      id: `sim:${s.udid}`,
      name: s.name,
      platform: "iOS",
      // The runtime already reads "iOS 26.3"; the platform column says iOS, so
      // strip the prefix rather than printing it twice.
      meta: s.runtime.replace(/^iOS\s*/, ""),
      running: s.state === "Booted",
      toggleLabel: s.state === "Booted" ? "Shutdown" : "Boot",
      resetLabel: "Erase",
      resetWarning: "All apps, data and caches are wiped.",
      toggle: () =>
        invoke(
          s.state === "Booted" ? "shutdown_simulator" : "boot_simulator",
          { udid: s.udid },
        ),
      reset: () => invoke("erase_simulator", { udid: s.udid }),
    }));

    // Running devices first — they are what you came here to act on.
    return [...android, ...ios].sort(
      (x, y) => Number(y.running) - Number(x.running),
    );
  }, [avds, sims]);

  /** The same row shape, fed by whatever runtimes this machine actually has. */
  const runtimeDevices: Device[] = useMemo(
    () =>
      runtimes.map((r) => ({
        id: r.id,
        name: r.name,
        platform: r.kind,
        meta: r.meta,
        running: r.running,
        toggleLabel: r.running ? "Stop" : "Start",
        resetLabel: "Remove",
        resetWarning: "The container and its writable layer are deleted.",
        toggle:
          (r.running ? r.can_stop : r.can_start)
            ? () =>
                invoke("runtime_action", {
                  id: r.id,
                  action: r.running ? "stop" : "start",
                })
            : null,
        reset: r.can_remove
          ? () => invoke("runtime_action", { id: r.id, action: "remove" })
          : null,
      })),
    [runtimes],
  );

  /**
   * Collapse the flat port list into families: one row per process (carrying
   * all of its ports), nested under the topmost listening ancestor. Three
   * `qemu` rows on 5554/5555/8554 are one process, and that process belongs to
   * the emulator that spawned it — showing them as six unrelated rows was the
   * noise.
   */
  const families = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const rows = q
      ? ports.filter((p) =>
          `${p.port} ${p.name} ${p.detail}`.toLowerCase().includes(q),
        )
      : ports;

    const procs = new Map<number, Proc & { family: number }>();
    for (const p of rows) {
      const existing = procs.get(p.pid);
      if (existing) existing.ports.push(p.port);
      else
        procs.set(p.pid, {
          pid: p.pid,
          name: p.name,
          detail: p.detail,
          memory: p.memory,
          ports: [p.port],
          family: p.family,
        });
    }
    for (const proc of procs.values()) proc.ports.sort((a, b) => a - b);

    // Collect members first, then pick the root — deciding the root while
    // iterating drops whichever member arrives before it.
    const members = new Map<number, Proc[]>();
    for (const proc of [...procs.values()].sort((a, b) => a.pid - b.pid)) {
      // A filter can hide the root; then the survivor heads its own family.
      const rootId = procs.has(proc.family) ? proc.family : proc.pid;
      const list = members.get(rootId);
      if (list) list.push(proc);
      else members.set(rootId, [proc]);
    }

    const grouped = new Map<number, Family>();
    for (const [rootId, procsInFamily] of members) {
      const root =
        procsInFamily.find((p) => p.pid === rootId) ?? procsInFamily[0];
      grouped.set(rootId, {
        root,
        children: procsInFamily.filter((p) => p !== root),
      });
    }

    const weight = (f: Family) => {
      const all = [f.root, ...f.children];
      switch (sort.key) {
        case "memory":
          return all.reduce((sum, p) => sum + p.memory, 0);
        case "pid":
          return f.root.pid;
        default:
          return Math.min(...all.flatMap((p) => p.ports));
      }
    };

    return [...grouped.values()].sort((a, b) =>
      sort.key === "name"
        ? a.root.name.localeCompare(b.root.name) * sort.dir
        : (weight(a) - weight(b)) * sort.dir,
    );
  }, [ports, filter, sort]);

  const visibleCount = families.reduce(
    (n, f) => n + [f.root, ...f.children].reduce((m, p) => m + p.ports.length, 0),
    0,
  );

  /** Same column flips direction; a new column starts at its natural one. */
  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: (s.dir * -1) as 1 | -1 }
        : { key, dir: defaultDir(key) },
    );

  return (
    <div className="app">
      <header className="toolbar">
        <h1 className="wordmark">
          portiye<span className="wordmark__dot">.</span>
        </h1>

        <div className="toolbar__spacer" />

        <div className="field">
          <input
            ref={filterRef}
            className="field__input"
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter ports"
            aria-label="Filter ports by number, process or path"
          />
          <span className="field__kbd">⌘K</span>
        </div>

        <button
          className="btn btn--icon"
          onClick={refresh}
          aria-label="Refresh now"
          title="Refresh now"
        >
          <RefreshIcon />
        </button>

        <button
          className="btn btn--icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>
      </header>

      {error && (
        <p className="banner" role="alert">
          <span className="banner__text">{error}</span>
          <button
            className="btn btn--icon"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
          >
            <CloseIcon />
          </button>
        </p>
      )}

      <DevicePanel
        title="Devices"
        devices={devices}
        busy={busy}
        run={run}
        empty="No emulators or simulators found. Create one in Android Studio, or install Xcode for iOS devices."
      />

      {/* Hidden entirely when the machine has no Docker, Ollama or JVM
          daemons — an empty panel would only be noise. */}
      {runtimeDevices.length > 0 && (
        <DevicePanel
          title="Runtimes"
          devices={runtimeDevices}
          busy={busy}
          run={run}
        />
      )}

      <section className="panel panel--fill">
        <div className="panel__head">
          <h2 className="panel__title">
            {/* Everything in this panel is listening by definition — unlike
                Devices and Runtimes, the state is uniform, so the dot belongs
                on the heading rather than on each row. */}
            <span className="dot dot--live" aria-hidden="true" />
            Listening ports
          </h2>
          <span className="panel__count">
            {filter ? `${visibleCount} / ${ports.length}` : ports.length}
          </span>
        </div>
        <div className="panel__scroll">
          {families.length === 0 ? (
            <p className="empty">
              {ports.length === 0 ? (
                "Nothing is listening on this machine."
              ) : (
                <>
                  No port matches “{filter}”.
                  <button
                    className="btn empty__action"
                    onClick={() => setFilter("")}
                  >
                    Clear filter
                  </button>
                </>
              )}
            </p>
          ) : (
            <>
              <div className="ports__head">
                <SortHead sort={sort} onSort={toggleSort} k="port" cell="port__number">
                  Port
                </SortHead>
                <SortHead sort={sort} onSort={toggleSort} k="name" cell="port__text">
                  Process
                </SortHead>
                <SortHead sort={sort} onSort={toggleSort} k="memory" cell="port__mem">
                  Memory
                </SortHead>
                <SortHead sort={sort} onSort={toggleSort} k="pid" cell="port__pid">
                  PID
                </SortHead>
                <span className="port__action" aria-hidden="true" />
              </div>
              <ul className="ports">
                {families.map((f) =>
                  [f.root, ...f.children].map((proc, i) => (
                    <ProcRow
                      key={proc.pid}
                      proc={proc}
                      child={i > 0}
                      busy={busy === `port:${proc.pid}`}
                      onKill={() =>
                        run(`port:${proc.pid}`, () =>
                          invoke("kill_process", { pid: proc.pid }),
                        )
                      }
                    />
                  )),
                )}
              </ul>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

/** A titled list of devices — emulators, or runtimes, or anything row-shaped. */
function DevicePanel({
  title,
  devices,
  busy,
  run,
  empty,
}: {
  title: string;
  devices: Device[];
  busy: string | null;
  run: (id: string, action: () => Promise<void>) => void;
  empty?: string;
}) {
  const running = devices.filter((d) => d.running).length;

  return (
    <section className="panel">
      <div className="panel__head">
        <h2 className="panel__title">{title}</h2>
        <span className="panel__count">
          {running} / {devices.length} running
        </span>
      </div>
      <div className="panel__body">
        {devices.length === 0 ? (
          <p className="empty">{empty}</p>
        ) : (
          <ul className="devices">
            {devices.map((d) => (
              <DeviceRow
                key={d.id}
                device={d}
                busy={busy === d.id}
                onToggle={() => d.toggle && run(d.id, d.toggle)}
                onReset={() => {
                  if (d.reset && confirm(`Reset “${d.name}”?\n${d.resetWarning}`))
                    run(d.id, d.reset);
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/**
 * One process. Extra ports collapse into a `+n` chip rather than repeating the
 * row, so the fixed column widths (and the sortable header) stay aligned.
 */
function ProcRow({
  proc,
  child,
  busy,
  onKill,
}: {
  proc: Proc;
  child: boolean;
  busy: boolean;
  onKill: () => void;
}) {
  const [first, ...rest] = proc.ports;
  const allPorts = proc.ports.map((p) => `:${p}`).join(", ");

  return (
    <li className={child ? "port port--child" : "port"}>
      <span className="port__number" title={rest.length ? allPorts : undefined}>
        :{first}
        {rest.length > 0 && <span className="port__more">+{rest.length}</span>}
      </span>
      <span className="port__text">
        <span className="port__name">
          {child && (
            <span className="port__branch" aria-hidden="true">
              ↳
            </span>
          )}
          {proc.name}
        </span>
        {proc.detail && (
          <span className="port__detail" title={proc.detail}>
            {proc.detail}
          </span>
        )}
      </span>
      <span className="port__mem">{mb(proc.memory)}</span>
      <span className="port__pid">{proc.pid}</span>
      <span className="port__action">
        <button
          className="btn btn--danger"
          disabled={busy}
          aria-busy={busy}
          onClick={onKill}
          aria-label={`Kill ${proc.name} on ${allPorts}`}
        >
          {busy ? "…" : "Kill"}
        </button>
      </span>
    </li>
  );
}

/**
 * A column header that sorts. The direction lives in the arrow's rotation and
 * in the accessible name, so it never depends on the glyph alone.
 */
function SortHead({
  sort,
  onSort,
  k,
  cell,
  children,
}: {
  sort: Sort;
  onSort: (k: SortKey) => void;
  k: SortKey;
  cell: string;
  children: string;
}) {
  const active = sort.key === k;
  const next = active
    ? sort.dir === 1
      ? "descending"
      : "ascending"
    : defaultDir(k) === 1
      ? "ascending"
      : "descending";

  return (
    <span className={cell}>
      <button
        className="sort"
        data-active={active || undefined}
        data-dir={active && sort.dir === -1 ? "desc" : undefined}
        onClick={() => onSort(k)}
        aria-label={`Sort by ${children.toLowerCase()}, ${next}`}
      >
        {children}
        <SortArrowIcon />
      </button>
    </span>
  );
}

function DeviceRow({
  device,
  busy,
  onToggle,
  onReset,
}: {
  device: Device;
  busy: boolean;
  onToggle: () => void;
  onReset: () => void;
}) {
  return (
    <li className={device.running ? "device device--live" : "device"}>
      <span
        className={device.running ? "dot dot--live" : "dot"}
        aria-hidden="true"
      />
      <span className="device__text">
        <span className="device__name" title={device.name}>
          {device.name}
        </span>
        <span className="device__meta">
          {device.platform}
          <span aria-hidden="true">·</span>
          {/* Running state is carried by the dot and the button label, so the
              meta line stays purely identifying. */}
          <span>{device.meta}</span>
        </span>
      </span>
      <span className="device__actions">
        {device.toggle && (
          <button
            className={device.running ? "btn" : "btn btn--primary"}
            disabled={busy}
            aria-busy={busy}
            onClick={onToggle}
          >
            {busy ? "…" : device.toggleLabel}
          </button>
        )}
        {device.reset && (
          <button
            className="btn btn--danger"
            disabled={busy}
            aria-busy={busy}
            onClick={onReset}
          >
            {device.resetLabel}
          </button>
        )}
      </span>
    </li>
  );
}
