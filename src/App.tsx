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
};
type Avd = { name: string; serial: string | null };
type Simulator = { udid: string; name: string; state: string; runtime: string };

/**
 * Android emulators and iOS simulators carry the same shape — a name, a
 * platform, one line of meta, a running flag, a start/stop action and a
 * destructive reset. One row type renders both.
 */
type Device = {
  id: string;
  name: string;
  platform: "Android" | "iOS";
  meta: string;
  running: boolean;
  toggleLabel: string;
  resetLabel: string;
  toggle: () => Promise<void>;
  reset: () => Promise<void>;
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
  const [ports, setPorts] = useState<PortEntry[]>([]);
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<Sort>({ key: "port", dir: 1 });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const filterRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const [a, s, p] = await Promise.all([
        invoke<Avd[]>("list_avds"),
        invoke<Simulator[]>("list_simulators"),
        invoke<PortEntry[]>("get_listening_ports"),
      ]);
      setAvds(a);
      setSims(s);
      setPorts(p);
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
      resetWarning: "All apps, data and snapshots are erased, then it cold boots.",
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

  const runningCount = devices.filter((d) => d.running).length;

  const visiblePorts = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const rows = q
      ? ports.filter((p) =>
          `${p.port} ${p.name} ${p.detail}`.toLowerCase().includes(q),
        )
      : [...ports];

    const { key, dir } = sort;
    return rows.sort((a, b) =>
      key === "name"
        ? a.name.localeCompare(b.name) * dir || a.port - b.port
        : (a[key] - b[key]) * dir,
    );
  }, [ports, filter, sort]);

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

      <section className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Devices</h2>
          <span className="panel__count">
            {runningCount} / {devices.length} running
          </span>
        </div>
        <div className="panel__body">
          {devices.length === 0 ? (
            <p className="empty">
              No emulators or simulators found. Create one in Android Studio, or
              install Xcode for iOS devices.
            </p>
          ) : (
            <ul className="devices">
              {devices.map((d) => (
                <DeviceRow
                  key={d.id}
                  device={d}
                  busy={busy === d.id}
                  onToggle={() => run(d.id, d.toggle)}
                  onReset={() => {
                    if (confirm(`Reset “${d.name}”?\n${d.resetWarning}`))
                      run(d.id, d.reset);
                  }}
                />
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="panel panel--fill">
        <div className="panel__head">
          <h2 className="panel__title">Listening ports</h2>
          <span className="panel__count">
            {filter ? `${visiblePorts.length} / ${ports.length}` : ports.length}
          </span>
        </div>
        <div className="panel__scroll">
          {visiblePorts.length === 0 ? (
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
              {visiblePorts.map((p) => (
                <li className="port" key={`${p.pid}:${p.port}`}>
                  <span className="port__number">:{p.port}</span>
                  <span className="port__text">
                    <span className="port__name">{p.name}</span>
                    {p.detail && (
                      <span className="port__detail" title={p.detail}>
                        {p.detail}
                      </span>
                    )}
                  </span>
                  <span className="port__mem">{mb(p.memory)}</span>
                  <span className="port__pid">{p.pid}</span>
                  <span className="port__action">
                    <button
                      className="btn btn--danger"
                      disabled={busy === `port:${p.pid}`}
                      aria-busy={busy === `port:${p.pid}`}
                      onClick={() =>
                        run(`port:${p.pid}`, () =>
                          invoke("kill_process", { pid: p.pid }),
                        )
                      }
                    >
                      {busy === `port:${p.pid}` ? "…" : "Kill"}
                    </button>
                  </span>
                </li>
              ))}
              </ul>
            </>
          )}
        </div>
      </section>
    </div>
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
        <button
          className={device.running ? "btn" : "btn btn--primary"}
          disabled={busy}
          aria-busy={busy}
          onClick={onToggle}
        >
          {busy ? "…" : device.toggleLabel}
        </button>
        <button
          className="btn btn--danger"
          disabled={busy}
          aria-busy={busy}
          onClick={onReset}
        >
          {device.resetLabel}
        </button>
      </span>
    </li>
  );
}
