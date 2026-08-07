import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useTheme } from "./theme";
import { warningFor } from "./risk";
import { runtimeOf } from "./runtime";
import { useConfirm } from "./Confirm";
import { usePersisted } from "./hooks/usePersisted";
import { useShortcuts } from "./hooks/useShortcuts";
import { Toolbar } from "./components/Toolbar";
import { DevicePanel } from "./components/DevicePanel";
import { FastKill } from "./components/FastKill";
import { PortTable } from "./components/PortTable";
import { History } from "./components/History";
import { ProcessDetail } from "./components/ProcessDetail";
import { LogView } from "./components/LogView";
import { CloseIcon } from "./icons";
import { defaultDir, mb, THRESHOLDS, thresholdLabel } from "./types";
import type {
  Avd,
  Device,
  Family,
  KillGroup,
  KillReport,
  PortEntry,
  Proc,
  RuntimeItem,
  Simulator,
  Sort,
  SortKey,
} from "./types";

export default function App() {
  const [theme, setTheme] = useTheme();
  const [avds, setAvds] = useState<Avd[]>([]);
  const [sims, setSims] = useState<Simulator[]>([]);
  const [runtimes, setRuntimes] = useState<RuntimeItem[]>([]);
  const [ports, setPorts] = useState<PortEntry[]>([]);
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<Sort>({ key: "port", dir: 1 });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; path?: string } | null>(
    null,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const [ask, confirmDialog] = useConfirm();

  const [view, setView] = useState<"ports" | "history" | "logs">("ports");
  const [detailPid, setDetailPid] = useState<number | null>(null);
  /** Bumped on every watcher event so the history view refetches. */
  const [revision, setRevision] = useState(0);

  const [savedFilters, setSavedFilters] = usePersisted<string[]>("filters", []);
  const [format, setFormat] = usePersisted<"json" | "csv">("format", "json");
  const [memoryWarnMb, setMemoryWarnMb] = usePersisted("memoryWarnMb", 500);

  /**
   * Ports only. This is a cached read on the Rust side — the watcher already
   * did the scan — so it is cheap enough to run on every event.
   */
  const refreshPorts = useCallback(async () => {
    try {
      setPorts(await invoke<PortEntry[]>("get_listening_ports"));
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  /**
   * Devices and runtimes. Each of these shells out — `simctl list` alone costs
   * ~0.8s, `docker ps` ~0.2s — so running them on the 5-second port tick meant
   * the app spent a fifth of its life spawning subprocesses, which is what the
   * stutter was. Emulators and containers change when *you* change them, so
   * this runs on demand and on a slow timer instead.
   */
  const refreshDevices = useCallback(async () => {
    try {
      const [a, s, r] = await Promise.all([
        invoke<Avd[]>("list_avds"),
        invoke<Simulator[]>("list_simulators"),
        invoke<RuntimeItem[]>("list_runtimes"),
      ]);
      setAvds(a);
      setSims(s);
      setRuntimes(r);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([refreshPorts(), refreshDevices()]);
  }, [refreshPorts, refreshDevices]);

  // The Rust watcher owns the only poll loop; this just reacts to it. Two
  // pollers meant two scans of the same machine every five seconds.
  useEffect(() => {
    refresh();
    const un = listen("ports-changed", () => {
      refreshPorts();
      setRevision((r) => r + 1);
    });
    // Device enumeration on a slow timer, and a backstop for ports in case the
    // watcher thread ever dies and stops emitting.
    const devices = setInterval(refreshDevices, 30_000);
    const backstop = setInterval(refreshPorts, 15_000);
    return () => {
      clearInterval(devices);
      clearInterval(backstop);
      un.then((f) => f());
    };
  }, [refresh, refreshPorts, refreshDevices]);

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
      restart: () => invoke("restart_avd", { name: a.name, serial: a.serial }),
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
        invoke(s.state === "Booted" ? "shutdown_simulator" : "boot_simulator", {
          udid: s.udid,
        }),
      restart: () => invoke("restart_simulator", { udid: s.udid }),
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
        toggle: (r.running ? r.can_stop : r.can_start)
          ? () =>
              invoke("runtime_action", {
                id: r.id,
                action: r.running ? "stop" : "start",
              })
          : null,
        // Containers restart through their own supervisor; a stop/start pair
        // from here would fight it.
        restart: null,
        reset: r.can_remove
          ? () => invoke("runtime_action", { id: r.id, action: "remove" })
          : null,
      })),
    [runtimes],
  );

  /**
   * Collapse the flat port list into families: one row per process (carrying
   * all of its ports), nested under the topmost listening ancestor.
   */
  const families: Family[] = useMemo(() => {
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
    for (const [rootId, inFamily] of members) {
      const root = inFamily.find((p) => p.pid === rootId) ?? inFamily[0];
      grouped.set(rootId, {
        root,
        children: inFamily.filter((p) => p !== root),
      });
    }

    const lowestPort = (f: Family) =>
      Math.min(...[f.root, ...f.children].flatMap((p) => p.ports));

    const weight = (f: Family) => {
      const all = [f.root, ...f.children];
      switch (sort.key) {
        case "memory":
          return all.reduce((sum, p) => sum + p.memory, 0);
        case "pid":
          return f.root.pid;
        // How many processes belong together — a lone process weighs 1.
        case "family":
          return all.length;
        default:
          return lowestPort(f);
      }
    };

    return [...grouped.values()].sort((a, b) => {
      if (sort.key === "name")
        return a.root.name.localeCompare(b.root.name) * sort.dir;
      const delta = (weight(a) - weight(b)) * sort.dir;
      // Equal weights would otherwise land in map-insertion order.
      return delta || lowestPort(a) - lowestPort(b);
    });
  }, [ports, filter, sort]);

  const shownProcs = useMemo(
    () => families.flatMap((f) => [f.root, ...f.children]),
    [families],
  );

  /**
   * Fast Kill targets: names holding more than one process, plus language
   * runtimes that spread across differently-named executables.
   */
  const killGroups: KillGroup[] = useMemo(() => {
    const bucket = (key: (p: Proc) => string | null) => {
      const map = new Map<string, Proc[]>();
      for (const proc of shownProcs) {
        const k = key(proc);
        if (!k) continue;
        const list = map.get(k);
        if (list) list.push(proc);
        else map.set(k, [proc]);
      }
      return [...map.entries()].filter(([, procs]) => procs.length > 1);
    };

    const build = (
      entries: [string, Proc[]][],
      kind: KillGroup["kind"],
    ): KillGroup[] =>
      entries.map(([name, procs]) => ({
        name,
        kind,
        procs,
        memory: procs.reduce((sum, p) => sum + p.memory, 0),
        // A runtime sweep is only as risky as the riskiest thing in it.
        warning: procs.map((p) => warningFor(p.name)).find(Boolean) ?? null,
      }));

    const byName = build(bucket((p) => p.name), "name");
    const fingerprint = (g: KillGroup) =>
      g.procs
        .map((p) => p.pid)
        .sort((a, b) => a - b)
        .join(",");
    const seen = new Set(byName.map(fingerprint));

    // A runtime group covering exactly one name group is the same button
    // twice — drop it and keep the specific one.
    const byRuntime = build(bucket((p) => runtimeOf(p.name)), "runtime").filter(
      (g) => !seen.has(fingerprint(g)),
    );

    return [
      ...byRuntime.sort((a, b) => b.procs.length - a.procs.length),
      ...byName.sort(
        (a, b) => b.procs.length - a.procs.length || b.memory - a.memory,
      ),
    ];
  }, [shownProcs]);

  const visibleCount = shownProcs.reduce((n, p) => n + p.ports.length, 0);

  /** Selection only ever refers to rows still on screen. */
  useEffect(() => {
    setSelected((prev) => {
      const alive = new Set(shownProcs.map((p) => p.pid));
      const next = new Set([...prev].filter((pid) => alive.has(pid)));
      return next.size === prev.size ? prev : next;
    });
  }, [shownProcs]);

  /**
   * The one kill path. Bulk selection, a Fast Kill chip and a single row all
   * arrive here, so the confirmation and the elevation retry cannot drift
   * apart between them.
   */
  const killMany = async (
    id: string,
    title: string,
    procs: Proc[],
    warning: string | null,
  ) => {
    if (procs.length === 0) return;
    const ok = await ask({
      title,
      // The detail line is what makes a bulk kill safe to approve: it says
      // which project or app each PID actually belongs to.
      lines: procs.map((p) => ({
        primary: `${p.name} · pid ${p.pid} · :${p.ports.join(", :")} · ${mb(p.memory)}`,
        secondary: p.detail || undefined,
      })),
      warning,
      // Whatever these spawned goes with them: killing a `dotnet watch` or
      // `npm run dev` on its own leaves the real server running and orphaned.
      note: "Processes they started are killed too.",
      confirmLabel: `Kill ${procs.length}`,
    });
    if (!ok) return;

    setBusy(id);
    try {
      const report = await invoke<KillReport>("kill_processes", {
        pids: procs.map((p) => p.pid),
      });

      if (report.children.length > 0)
        setNotice({
          text: `Killed ${report.killed.length} + ${report.children.length} child ${report.children.length === 1 ? "process" : "processes"}`,
        });

      if (report.denied.length > 0) {
        const elevate = await ask({
          title: `${report.denied.length} of ${procs.length} refused to close`,
          lines: report.denied.map((pid) => {
            const proc = procs.find((p) => p.pid === pid);
            return {
              primary: `${proc?.name ?? "process"} · pid ${pid}`,
              secondary: proc?.detail || undefined,
            };
          }),
          warning: `They belong to another user. ${report.elevation}`,
          confirmLabel: "Retry as administrator",
        });
        if (elevate)
          await invoke("kill_processes_elevated", { pids: report.denied });
      }
      setSelected(new Set());
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  const killSelected = () => {
    const procs = shownProcs.filter((p) => selected.has(p.pid));
    killMany(
      "selection",
      `Kill ${procs.length} selected ${procs.length === 1 ? "process" : "processes"}?`,
      procs,
      procs.map((p) => warningFor(p.name)).find(Boolean) ?? null,
    );
  };

  const exportSnapshot = async () => {
    try {
      const rows = shownProcs.flatMap((p) =>
        p.ports.map((port) => ({
          port,
          name: p.name,
          detail: p.detail,
          pid: p.pid,
          memory_bytes: p.memory,
        })),
      );
      // The stamp is built here: the webview owns the user's clock and locale.
      const stamp = new Date().toISOString().slice(0, 19);
      const path = await invoke<string>("export_snapshot", {
        rows,
        format,
        stamp,
      });
      setNotice({ text: `Exported ${rows.length} rows`, path });
    } catch (e) {
      setError(String(e));
    }
  };

  useShortcuts({
    "mod+k": () => filterRef.current?.select(),
    "mod+f": () => filterRef.current?.select(),
    "mod+r": refresh,
    "mod+e": exportSnapshot,
    "mod+a": () => setSelected(new Set(shownProcs.map((p) => p.pid))),
    "mod+backspace": killSelected,
    Escape: () => setSelected(new Set()),
  });

  /** Same column flips direction; a new column starts at its natural one. */
  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: (s.dir * -1) as 1 | -1 }
        : { key, dir: defaultDir(key) },
    );

  const toggleSelect = (pid: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(pid) ? next.delete(pid) : next.add(pid);
      return next;
    });

  const toggleAll = () =>
    setSelected((prev) =>
      prev.size === shownProcs.length
        ? new Set()
        : new Set(shownProcs.map((p) => p.pid)),
    );

  const saveFilter = () => {
    const q = filter.trim();
    if (q && !savedFilters.includes(q))
      setSavedFilters((prev) => [q, ...prev].slice(0, 12));
  };

  return (
    <div className="app">
      <Toolbar
        view={view}
        onView={setView}
        theme={theme}
        onTheme={setTheme}
        onRefresh={refresh}
        format={format}
        onFormat={setFormat}
        onExport={exportSnapshot}
      />

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

      {notice && (
        <p className="banner banner--ok" role="status">
          <span className="banner__text">
            {notice.text}
            {notice.path && ` → ${notice.path}`}
          </span>
          {notice.path && (
            <button
              className="btn"
              onClick={() => revealItemInDir(notice.path!)}
            >
              Reveal
            </button>
          )}
          <button
            className="btn btn--icon"
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
          >
            <CloseIcon />
          </button>
        </p>
      )}

      {view === "history" && <History revision={revision} />}
      {view === "logs" && <LogView devices={devices} />}


      {view === "ports" && (
      <>
      <DevicePanel
        title="Devices"
        devices={devices}
        busy={busy}
        run={run}
        ask={ask}
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
          ask={ask}
        />
      )}

      <section className="panel panel--fill">
        <div className="panel__head panel__head--tools">
          <h2 className="panel__title">
            {/* Everything in this panel is listening by definition — unlike
                Devices and Runtimes, the state is uniform, so the dot belongs
                on the heading rather than on each row. */}
            <span className="dot dot--live" aria-hidden="true" />
            Listening ports
          </h2>

          {selected.size > 0 && (
            <button
              className="btn btn--solid-danger"
              disabled={busy === "selection"}
              aria-busy={busy === "selection"}
              onClick={killSelected}
              title="Kill the selected processes (⌘⌫)"
            >
              Kill {selected.size} selected
            </button>
          )}

          {/* The filter only ever acted on this panel, so it lives with it. */}
          <div className="field">
            <input
              ref={filterRef}
              className="field__input"
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveFilter()}
              placeholder="Filter ports"
              aria-label="Filter ports by number, process or path"
              list="portiye-saved-filters"
            />
            <datalist id="portiye-saved-filters">
              {savedFilters.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
            <span className="field__kbd">⌘K</span>
          </div>

          {/* The threshold paints rows in this table and nothing else, so it
              belongs to the table rather than to the window chrome. */}
          <label className="toolbar__setting">
            Flag over
            <select
              className="select"
              value={memoryWarnMb}
              onChange={(e) => setMemoryWarnMb(Number(e.target.value))}
              aria-label="Flag processes using more memory than"
            >
              {THRESHOLDS.map((n) => (
                <option key={n} value={n}>
                  {thresholdLabel(n)}
                </option>
              ))}
            </select>
          </label>

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
              <FastKill
                groups={killGroups}
                busy={busy}
                onKill={(g) =>
                  killMany(
                    `fast:${g.kind}:${g.name}`,
                    `Kill ${g.procs.length} ${g.name} processes?`,
                    g.procs,
                    g.warning,
                  )
                }
              />
              <PortTable
                families={families}
                sort={sort}
                onSort={toggleSort}
                selected={selected}
                onToggleSelect={toggleSelect}
                onToggleAll={toggleAll}
                memoryWarn={memoryWarnMb * 1_048_576}
                openPid={detailPid}
                onOpen={(p) => setDetailPid((cur) => (cur === p.pid ? null : p.pid))}
                busy={busy}
                onKill={(proc) =>
                  killMany(
                    `port:${proc.pid}`,
                    `Kill ${proc.name}?`,
                    [proc],
                    warningFor(proc.name),
                  )
                }
              />
            </>
          )}
        </div>
      </section>

      {detailPid !== null && (
        <ProcessDetail
          pid={detailPid}
          onClose={() => setDetailPid(null)}
          onKill={() => {
            const proc = shownProcs.find((p) => p.pid === detailPid);
            if (proc)
              killMany(
                `port:${proc.pid}`,
                `Kill ${proc.name}?`,
                [proc],
                warningFor(proc.name),
              ).then(() => setDetailPid(null));
          }}
        />
      )}
      </>
      )}

      {confirmDialog}
    </div>
  );
}
