import type { Key } from "./i18n";

/** Shapes shared across the panels. Kept here so components stop importing
 *  each other just to borrow a type. */

/** Host-wide load. Bytes for memory and disk, 0–100 for cpu. */
export type SystemStats = {
  cpu: number;
  /** Null on a machine with no readable GPU counter — the gauge is hidden. */
  gpu: number | null;
  memory_total: number;
  memory_used: number;
  disk_total: number;
  disk_used: number;
  /** Mount point the disk figures describe. Empty when none was found. */
  disk_name: string;
};

export type PortEntry = {
  pid: number;
  port: number;
  name: string;
  detail: string;
  memory: number;
  cpu: number;
  /** Disk bytes per second, read + written. */
  disk: number;
  /** Percent of the GPU's SMs. Null unless NVIDIA's own sampler is running —
   *  no other platform reports a per-process share. */
  gpu: number | null;
  /** Video memory held, in bytes. 0 when unknown. */
  gpu_memory: number;
  family: number;
  /** Bound past loopback: reachable from a phone on the same network. */
  lan: boolean;
};

/** One process, with every port it holds. */
export type Proc = {
  pid: number;
  name: string;
  detail: string;
  memory: number;
  cpu: number;
  disk: number;
  gpu: number | null;
  gpuMemory: number;
  ports: number[];
  /** The subset of `ports` other devices on the LAN can reach. */
  lanPorts: number[];
};

/** A process and its listening descendants — `emulator` + the `qemu` it spawned. */
export type Family = { root: Proc; children: Proc[] };

/** Every listening process sharing one name, or one language runtime. */
export type KillGroup = {
  name: string;
  /** `runtime` sweeps a language across differently-named executables. */
  kind: "name" | "runtime";
  procs: Proc[];
  memory: number;
  /** Translation key for the risk warning, resolved where it is shown. */
  warning: Key | null;
};

export type KillReport = {
  killed: number[];
  /** Descendants killed alongside the targets — dev servers supervise. */
  children: number[];
  denied: number[];
  missing: number[];
  elevation: string;
};

export type Avd = { name: string; serial: string | null };
export type Simulator = {
  udid: string;
  name: string;
  state: string;
  runtime: string;
};

/** Docker containers, Ollama models, JVM build daemons — whatever is present. */
export type RuntimeItem = {
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
export type Device = {
  id: string;
  name: string;
  platform: string;
  meta: string;
  running: boolean;
  toggleLabel: string;
  toggle: (() => Promise<void>) | null;
  /** Stop-then-start, keeping data. Null for things that cannot restart. */
  restart: (() => Promise<void>) | null;
  reset: (() => Promise<void>) | null;
  resetLabel: string;
  resetWarning: string;
};

export type SortKey =
  | "port"
  | "name"
  | "cpu"
  | "disk"
  | "gpu"
  | "memory"
  | "pid"
  | "family";
export type Sort = { key: SortKey; dir: 1 | -1 };

/**
 * Memory, CPU, disk and group read descending by default — you open a load
 * column to find the biggest hog, and group to find the processes that belong
 * to something.
 */
export const defaultDir = (key: SortKey): 1 | -1 =>
  key === "memory" ||
  key === "cpu" ||
  key === "disk" ||
  key === "gpu" ||
  key === "family"
    ? -1
    : 1;

/** Bytes per second, for the disk column. Idle is a dash, not "0 KB/s". */
export const rate = (bytes: number) => {
  if (bytes < 1024) return "—";
  if (bytes < 1_048_576) return `${Math.round(bytes / 1024)} KB/s`;
  return `${(bytes / 1_048_576).toFixed(1)} MB/s`;
};

export const mb = (bytes: number) =>
  bytes >= 1_073_741_824
    ? `${(bytes / 1_073_741_824).toFixed(1)} GB`
    : `${Math.round(bytes / 1_048_576)} MB`;

/** Thresholds offered for the heavy-process marker, in MB. */
export const THRESHOLDS = [100, 250, 500, 1000, 2000];

export const thresholdLabel = (mb: number) =>
  mb >= 1000 ? `${mb / 1000} GB` : `${mb} MB`;

/**
 * What the window draws. One object rather than six booleans threaded through
 * three components — they are set together, in one place, and read together.
 */
export type Panels = {
  devices: boolean;
  system: boolean;
  cpu: boolean;
  /** Not display-only: off, the Rust side stops measuring the GPU. */
  gpu: boolean;
  memory: boolean;
  disk: boolean;
};

/** What the menu-bar / system-tray icon shows, and whether it is there. */
export type TrayOptions = {
  visible: boolean;
  /** The one-line CPU · GPU · RAM · DISK readout at the top of the menu. */
  stats: boolean;
  ports: boolean;
  devices: boolean;
};

export const DEFAULT_PANELS: Panels = {
  devices: true,
  system: true,
  cpu: true,
  gpu: true,
  memory: true,
  disk: true,
};

export const DEFAULT_TRAY: TrayOptions = {
  visible: true,
  stats: true,
  ports: true,
  devices: true,
};
