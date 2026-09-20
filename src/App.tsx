import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useTheme } from "./theme";
import { warningFor } from "./risk";
import { runtimeOf } from "./runtime";
import { useConfirm } from "./Confirm";
import { useI18n } from "./i18n";
import { usePersisted } from "./hooks/usePersisted";
import { useShortcuts } from "./hooks/useShortcuts";
import { Toolbar, type View } from "./components/Toolbar";
import { DevicePanel } from "./components/DevicePanel";
import { SystemPanel } from "./components/SystemPanel";
import { FastKill } from "./components/FastKill";
import { PortTable } from "./components/PortTable";
import { Settings } from "./components/Settings";
import { History } from "./components/History";
import { ProcessDetail } from "./components/ProcessDetail";
import { LogView } from "./components/LogView";
import { CloseIcon } from "./icons";
import { DEFAULT_PANELS, DEFAULT_TRAY, defaultDir, mb } from "./types";
import type { Key } from "./i18n";
import type {
  AiTool,
  Avd,
  Device,
  Family,
  KillGroup,
  KillReport,
  Panels,
  PortEntry,
  Proc,
  RuntimeItem,
  Simulator,
  Sort,
  SortKey,
  SystemStats,
  TrayOptions,
} from "./types";

export default function App() {
  const { t, locale } = useI18n();
  const [theme, setTheme] = useTheme();
  const [avds, setAvds] = useState<Avd[]>([]);
  const [sims, setSims] = useState<Simulator[]>([]);
  const [runtimes, setRuntimes] = useState<RuntimeItem[]>([]);
  const [aiTools, setAiTools] = useState<AiTool[]>([]);
  /** Which list the shared panel shows. The other one is not fetched at all —
   *  that is the point of the strip, not just less on screen. */
  const [toolTab, setToolTab] = usePersisted<"devices" | "ai">(
    "toolTab",
    "devices",
  );
  const [ports, setPorts] = useState<PortEntry[]>([]);
  const [system, setSystem] = useState<SystemStats | null>(null);
  /** This machine's LAN address, or null when it is on no network. */
  const [lanIp, setLanIp] = useState<string | null>(null);
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

  const [view, setView] = useState<View>("ports");
  const [detailPid, setDetailPid] = useState<number | null>(null);
  /** Bumped on every watcher event so the history view refetches. */
  const [revision, setRevision] = useState(0);

  const [savedFilters, setSavedFilters] = usePersisted<string[]>("filters", []);
  const [format, setFormat] = usePersisted<"json" | "csv">("format", "json");
  const [memoryWarnMb, setMemoryWarnMb] = usePersisted("memoryWarnMb", 500);
  /** Whether a process nests under whatever spawned it. Off, the table is one
   *  flat row per process — the same processes, none hidden. */
  const [nest, setNest] = usePersisted("nest", true);
  /** Spread over the defaults, not read raw: a settings object saved by an
   *  older build is missing whatever was added since. */
  const [savedPanels, setPanels] = usePersisted("panels", DEFAULT_PANELS);
  const [savedTray, setTray] = usePersisted("tray", DEFAULT_TRAY);
  const panels: Panels = useMemo(
    () => ({ ...DEFAULT_PANELS, ...savedPanels }),
    [savedPanels],
  );
  const tray: TrayOptions = useMemo(
    () => ({ ...DEFAULT_TRAY, ...savedTray }),
    [savedTray],
  );

  // Both settings live in the webview's storage, so the Rust side has to be
  // told — on every start, not only when they change. Neither is cosmetic:
  // one stops the GPU probes, the other stops building a menu.
  useEffect(() => {
    invoke("set_gpu_enabled", { enabled: panels.gpu }).catch(() => {});
  }, [panels.gpu]);

  // Same contract for the disk: off, the poller stops enumerating volumes.
  useEffect(() => {
    invoke("set_disk_enabled", { enabled: panels.disk }).catch(() => {});
  }, [panels.disk]);

  useEffect(() => {
    invoke("set_tray_options", {
      visible: tray.visible,
      stats: tray.stats,
      ports: tray.ports,
      devices: tray.devices,
    }).catch(() => {});
  }, [tray.visible, tray.stats, tray.ports, tray.devices]);

  /** Who still wants the device lists: the open tab, or the tray's submenu.
   *  A tab nobody opened costs nothing — `simctl list` is 0.8s. */
  const wantDevices =
    (panels.devices && toolTab === "devices") || tray.devices;
  const wantAi = panels.ai && toolTab === "ai";

  /**
   * Ports only. This is a cached read on the Rust side — the watcher already
   * did the scan — so it is cheap enough to run on every event.
   */
  const refreshPorts = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([
        invoke<PortEntry[]>("get_listening_ports"),
        invoke<SystemStats>("get_system_stats"),
      ]);
      setPorts(p);
      setSystem(s);
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
    // Nothing on screen and nothing in the menu wants them: then the three
    // subprocesses are not run at all. Hiding the panel and still shelling out
    // to `simctl` every 30 seconds would be hiding the cost, not
    // removing it — and the Device Logs tab goes with them, because its picker
    // is these same lists.
    // Switched off entirely — not merely on the other tab, which keeps its
    // last list so the Device Logs tab does not lose its picker mid-session.
    if (!panels.devices && !tray.devices) {
      setAvds([]);
      setSims([]);
      setRuntimes([]);
    }

    // This one shells out to nothing: it walks the process list the poller
    // refreshed a moment ago. It still waits for its tab, because a tool
    // starting up is not a five-second question either.
    if (wantAi) {
      setAiTools(await invoke<AiTool[]>("list_ai_tools").catch(() => []));
    } else if (!panels.ai) {
      setAiTools([]);
    }

    // This machine's address is not device work, and the toolbar shows it
    // whatever the panels are set to.
    setLanIp(await invoke<string | null>("local_ip").catch(() => null));
    if (!wantDevices) return;

    // `allSettled`, not `all`: these three enumerate three unrelated toolchains
    // and most machines have only some of them. Under `all`, one missing tool
    // rejected the whole batch, so a box without the Android SDK lost its
    // simulators and its Docker containers too — and got a banner about
    // `emulator` every 30 seconds for the privilege.
    const [a, s, r] = await Promise.allSettled([
      invoke<Avd[]>("list_avds"),
      invoke<Simulator[]>("list_simulators"),
      invoke<RuntimeItem[]>("list_runtimes"),
    ]);
    if (a.status === "fulfilled") setAvds(a.value);
    if (s.status === "fulfilled") setSims(s.value);
    if (r.status === "fulfilled") setRuntimes(r.value);

    // A lister that fails is a real fault worth showing — but it clears itself
    // on the next good pass rather than waiting for an unrelated port tick.
    const failed = [a, s, r].find((x) => x.status === "rejected");
    setError(failed ? String(failed.reason) : null);
  }, [wantDevices, wantAi, panels.ai, panels.devices, tray.devices]);

  // The tray menu is drawn in Rust and cannot read the webview's dictionary,
  // so the chosen language is pushed to it. Rebuilding the menu is the whole
  // point, and it costs a cached read.
  useEffect(() => {
    invoke("set_locale", { locale }).catch(() => {});
  }, [locale]);

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
    // watcher thread ever dies and stops emitting. The backstop is deliberately
    // slower than the 5s tick it covers for: any faster only duplicates the
    // event that already arrived.
    const devices = setInterval(refreshDevices, 30_000);
    const backstop = setInterval(refreshPorts, 30_000);
    return () => {
      clearInterval(devices);
      clearInterval(backstop);
      un.then((f) => f());
    };
  }, [refresh, refreshPorts, refreshDevices]);

  /**
   * Log streaming needs `simctl` or `adb`, so a machine with neither Xcode nor
   * the Android SDK has no source and never will — the tab is hidden instead
   * of opening onto an empty picker. Stopped devices still count: the answer
   * there is "boot one", which the panel already says.
   */
  const canStreamLogs = avds.length > 0 || sims.length > 0;

  // Losing the tab while standing on it would leave a blank window.
  useEffect(() => {
    if (!canStreamLogs && view === "logs") setView("ports");
  }, [canStreamLogs, view]);

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
      toggleLabel: t(a.serial ? "device.stop" : "device.launch"),
      resetLabel: t("device.wipe"),
      resetWarning: t("device.wipeWarning"),
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
      toggleLabel: t(s.state === "Booted" ? "device.shutdown" : "device.boot"),
      resetLabel: t("device.erase"),
      resetWarning: t("device.eraseWarning"),
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
  }, [avds, sims, t]);

  /** The same row shape, fed by whatever runtimes this machine actually has. */
  const runtimeDevices: Device[] = useMemo(
    () =>
      runtimes.map((r) => ({
        id: r.id,
        name: r.name,
        platform: r.kind,
        meta: r.meta,
        running: r.running,
        toggleLabel: t(r.running ? "device.stop" : "device.start"),
        resetLabel: t("device.remove"),
        resetWarning: t("device.removeWarning"),
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
    [runtimes, t],
  );

  /**
   * Collapse the flat port list into families: one row per process (carrying
   * all of its ports), nested under the topmost listening ancestor.
   */
  const families: Family[] = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const rows = q
      ? ports.filter((p) =>
          `${p.port} ${p.name} ${p.detail} ${p.ai ?? ""}`
            .toLowerCase()
            .includes(q),
        )
      : ports;

    const procs = new Map<number, Proc & { family: number }>();
    for (const p of rows) {
      const existing = procs.get(p.pid);
      if (existing) {
        existing.ports.push(p.port);
        if (p.lan) existing.lanPorts.push(p.port);
      } else
        procs.set(p.pid, {
          pid: p.pid,
          name: p.name,
          detail: p.detail,
          memory: p.memory,
          // Every row for one pid carries the same process-wide figures, so
          // these are read once rather than summed over its ports.
          cpu: p.cpu,
          disk: p.disk,
          gpu: p.gpu,
          gpuMemory: p.gpu_memory,
          ports: [p.port],
          lanPorts: p.lan ? [p.port] : [],
          family: p.family,
          ai: p.ai,
        });
    }
    for (const proc of procs.values()) {
      proc.ports.sort((a, b) => a - b);
      proc.lanPorts.sort((a, b) => a - b);
    }

    // Collect members first, then pick the root — deciding the root while
    // iterating drops whichever member arrives before it.
    const members = new Map<number, Proc[]>();
    for (const proc of [...procs.values()].sort((a, b) => a.pid - b.pid)) {
      // A filter can hide the root; then the survivor heads its own family.
      // Grouping off means every process heads its own — nothing leaves the
      // table, it just stops nesting under whatever spawned it.
      const rootId =
        nest && procs.has(proc.family) ? proc.family : proc.pid;
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
        case "cpu":
          return all.reduce((sum, p) => sum + p.cpu, 0);
        case "disk":
          return all.reduce((sum, p) => sum + p.disk, 0);
        // Where nothing reports an SM share the column is video memory, and
        // so is the order it sorts in.
        case "gpu":
          return (
            all.reduce((sum, p) => sum + (p.gpu ?? 0), 0) ||
            all.reduce((sum, p) => sum + p.gpuMemory, 0)
          );
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
  }, [ports, filter, sort, nest]);

  /**
   * NVIDIA-only, so the column exists on the machines that have a sampler and
   * nowhere else — an empty GPU column would read as "nothing is using it".
   */
  const showGpu = useMemo(
    () => panels.gpu && ports.some((p) => p.gpu !== null || p.gpu_memory > 0),
    [panels.gpu, ports],
  );

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
        warning: procs.map((p) => warningFor(p.name, p.ai)).find(Boolean) ?? null,
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

  /** Sorting by a column nobody can see reads as a random order. */
  useEffect(() => {
    const hidden = {
      cpu: !panels.cpu,
      gpu: !showGpu,
      memory: !panels.memory,
      disk: !panels.disk,
    } as Partial<Record<SortKey, boolean>>;
    setSort((s) => (hidden[s.key] ? { key: "port", dir: 1 } : s));
  }, [panels.cpu, showGpu, panels.memory, panels.disk]);

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
    warning: Key | null,
  ) => {
    if (procs.length === 0) return;
    const ok = await ask({
      title,
      // The detail line is what makes a bulk kill safe to approve: it says
      // which project or app each PID actually belongs to.
      lines: procs.map((p) => ({
        primary: [
          p.name,
          `pid ${p.pid}`,
          p.ports.length ? `:${p.ports.join(", :")}` : null,
          mb(p.memory),
        ]
          .filter(Boolean)
          .join(" · "),
        secondary: p.detail || undefined,
      })),
      warning: warning && t(warning),
      // Whatever these spawned goes with them: killing a `dotnet watch` or
      // `npm run dev` on its own leaves the real server running and orphaned.
      note: t("kill.note"),
      confirmLabel: t("kill.confirm", { n: procs.length }),
    });
    if (!ok) return;

    setBusy(id);
    try {
      const report = await invoke<KillReport>("kill_processes", {
        pids: procs.map((p) => p.pid),
      });

      if (report.children.length > 0)
        setNotice({
          text: t(
            report.children.length === 1 ? "kill.childrenOne" : "kill.children",
            { n: report.killed.length, c: report.children.length },
          ),
        });

      // An empty hint means this machine has no way to ask for a password
      // (Linux without polkit), so the refusal is reported without offering a
      // retry that could only fail.
      if (report.denied.length > 0 && report.elevation) {
        const elevate = await ask({
          title: t("kill.deniedTitle", {
            n: report.denied.length,
            total: procs.length,
          }),
          lines: report.denied.map((pid) => {
            const proc = procs.find((p) => p.pid === pid);
            return {
              primary: `${proc?.name ?? t("kill.deniedProcess")} · pid ${pid}`,
              secondary: proc?.detail || undefined,
            };
          }),
          warning: t("kill.deniedWarning", { hint: report.elevation }),
          confirmLabel: t("kill.retryElevated"),
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
      procs.length === 1
        ? t("kill.titleSelectedOne")
        : t("kill.titleSelected", { n: procs.length }),
      procs,
      procs.map((p) => warningFor(p.name, p.ai)).find(Boolean) ?? null,
    );
  };

  /**
   * The AI panel's rows, in the shape every other panel already uses: a thing
   * that is running, one line of identity, one action. One row per tool rather
   * than per process — Codex alone is a dozen Electron helpers, and stopping
   * it means stopping all of them, which is exactly what the row does.
   */
  const aiDevices: Device[] = aiTools.map((tool) => {
    const id = `ai:${tool.name}`;
    // `killMany` wants processes; these hold no ports of their own, which the
    // confirmation prints around rather than filling in with a bare colon.
    const procs: Proc[] = tool.procs.map((p) => ({
      pid: p.pid,
      name: p.name,
      detail: "",
      memory: p.memory,
      cpu: 0,
      disk: 0,
      gpu: null,
      gpuMemory: 0,
      ports: [],
      lanPorts: [],
      ai: tool.name,
    }));

    return {
      id,
      name: tool.name,
      platform: t(tool.kind === "agent" ? "ai.agent" : "ai.model"),
      meta: [
        t(tool.procs.length === 1 ? "ai.oneProcess" : "ai.processes", {
          n: tool.procs.length,
        }),
        mb(tool.memory),
        // Rounds to nothing on an idle tool; a permanent "0%" would read as a
        // broken gauge rather than an idle agent.
        tool.cpu >= 1 ? `${Math.round(tool.cpu)}%` : null,
        tool.ports.length ? tool.ports.map((p) => `:${p}`).join(" ") : null,
      ]
        .filter(Boolean)
        .join(" · "),
      running: true,
      toggleLabel: t("device.stop"),
      // Through the one kill path: same confirmation, same child sweep, same
      // elevated retry as every other kill in the app.
      toggle: () =>
        killMany(
          id,
          t("ai.stopTitle", { name: tool.name }),
          procs,
          tool.kind === "agent" ? "risk.agent" : null,
        ),
      restart: null,
      reset: null,
      resetLabel: "",
      resetWarning: "",
      // Opened, the row lists the processes it would stop.
      members: tool.procs,
    };
  });

  /** Only the panels that are switched on; one of them is a heading, not a
   *  strip, and a tab switched off in Settings hands the panel to the other. */
  const toolTabs = [
    panels.devices && { id: "devices", label: t("devices.title") },
    panels.ai && { id: "ai", label: t("ai.title") },
  ].filter(Boolean) as { id: string; label: string }[];

  useEffect(() => {
    if (!toolTabs.some((tab) => tab.id === toolTab) && toolTabs[0])
      setToolTab(toolTabs[0].id as "devices" | "ai");
  }, [toolTabs, toolTab, setToolTab]);

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
      setNotice({ text: t("export.notice", { n: rows.length }), path });
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
        onExport={exportSnapshot}
        canStreamLogs={canStreamLogs}
        lanIp={lanIp}
      />

      {error && (
        <p className="banner" role="alert">
          <span className="banner__text">{error}</span>
          <button
            className="btn btn--icon"
            onClick={() => setError(null)}
            aria-label={t("banner.dismissError")}
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
              {t("banner.reveal")}
            </button>
          )}
          <button
            className="btn btn--icon"
            onClick={() => setNotice(null)}
            aria-label={t("banner.dismiss")}
          >
            <CloseIcon />
          </button>
        </p>
      )}

      {view === "history" && <History revision={revision} />}
      {view === "settings" && (
        <Settings
          panels={panels}
          onPanels={setPanels}
          tray={tray}
          onTray={setTray}
          memoryWarnMb={memoryWarnMb}
          onMemoryWarnMb={setMemoryWarnMb}
          format={format}
          onFormat={setFormat}
        />
      )}
      {view === "logs" && <LogView devices={devices} />}


      {view === "ports" && (
      <>
      <div className="shelf">
        {/* Devices and AI tools share one panel and one strip: an emulator list
            costs `simctl list` at 0.8s and the AI list costs a process walk, so
            the tab that is not open is not fetched at all. */}
        {(panels.devices || panels.ai) && (
          <>
            <DevicePanel
              title={t(toolTab === "ai" ? "ai.title" : "devices.title")}
              tabs={toolTabs}
              activeTab={toolTab}
              onTab={(id) => setToolTab(id as "devices" | "ai")}
              devices={toolTab === "ai" ? aiDevices : devices}
              busy={busy}
              run={run}
              ask={ask}
              empty={t(toolTab === "ai" ? "ai.empty" : "devices.empty")}
              onSettings={() => setView("settings")}
            />

            {/* Hidden entirely when the machine has no Docker, Ollama or JVM
                daemons — an empty panel would only be noise. */}
            {toolTab === "devices" && runtimeDevices.length > 0 && (
              <DevicePanel
                title={t("devices.runtimes")}
                devices={runtimeDevices}
                busy={busy}
                run={run}
                ask={ask}
                onSettings={() => setView("settings")}
              />
            )}
          </>
        )}

        {panels.system && (
          <SystemPanel
            stats={system}
            showCpu={panels.cpu}
            showGpu={panels.gpu}
            showMemory={panels.memory}
            showDisk={panels.disk}
            onSettings={() => setView("settings")}
          />
        )}
      </div>

      <section className="panel panel--fill">
        <div className="panel__head panel__head--tools">
          <h2 className="panel__title">
            {/* Everything in this panel is listening by definition — unlike
                Devices and Runtimes, the state is uniform, so the dot belongs
                on the heading rather than on each row. */}
            <span className="dot dot--live" aria-hidden="true" />
            {t("ports.title")}
          </h2>

          {selected.size > 0 && (
            <button
              className="btn btn--solid-danger"
              disabled={busy === "selection"}
              aria-busy={busy === "selection"}
              onClick={killSelected}
              title={t("ports.killSelectedTitle")}
            >
              {t("ports.killSelected", { n: selected.size })}
            </button>
          )}

          {/* Nesting is noise on a machine running one IDE with a dozen
              helpers. Off, every process is its own row, sorted on its own
              numbers — the same processes, one flat list. */}
          <button
            className="btn"
            aria-pressed={nest}
            onClick={() => setNest((v) => !v)}
            title={t("ports.childrenTitle")}
          >
            ↳ {t("ports.children")}
          </button>

          {/* The filter only ever acted on this panel, so it lives with it. */}
          <div className="field">
            <input
              ref={filterRef}
              className="field__input"
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveFilter()}
              placeholder={t("ports.filter")}
              aria-label={t("ports.filterAria")}
              list="portiye-saved-filters"
            />
            <datalist id="portiye-saved-filters">
              {savedFilters.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
            <span className="field__kbd">⌘K</span>
          </div>

          <span className="panel__count">
            {filter ? `${visibleCount} / ${ports.length}` : ports.length}
          </span>
        </div>

        <div className="panel__scroll">
          {families.length === 0 ? (
            <p className="empty">
              {ports.length === 0 ? (
                t("ports.emptyNone")
              ) : (
                <>
                  {t("ports.emptyFilter", { q: filter })}
                  <button
                    className="btn empty__action"
                    onClick={() => setFilter("")}
                  >
                    {t("ports.clearFilter")}
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
                    t("kill.titleGroup", { n: g.procs.length, name: g.name }),
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
                lanIp={lanIp}
                showCpu={panels.cpu}
                showGpu={showGpu}
                showMemory={panels.memory}
                showDisk={panels.disk}
                openPid={detailPid}
                onOpen={(p) => setDetailPid((cur) => (cur === p.pid ? null : p.pid))}
                busy={busy}
                onKill={(proc) =>
                  killMany(
                    `port:${proc.pid}`,
                    t("kill.titleOne", { name: proc.name }),
                    [proc],
                    warningFor(proc.name, proc.ai),
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
          lanIp={lanIp}
          lanPorts={
            shownProcs.find((p) => p.pid === detailPid)?.lanPorts ?? []
          }
          onClose={() => setDetailPid(null)}
          onKill={() => {
            const proc = shownProcs.find((p) => p.pid === detailPid);
            if (proc)
              killMany(
                `port:${proc.pid}`,
                t("kill.titleOne", { name: proc.name }),
                [proc],
                warningFor(proc.name, proc.ai),
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
