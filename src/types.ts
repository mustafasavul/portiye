/** Shapes shared across the panels. Kept here so components stop importing
 *  each other just to borrow a type. */

export type PortEntry = {
  pid: number;
  port: number;
  name: string;
  detail: string;
  memory: number;
  family: number;
};

/** One process, with every port it holds. */
export type Proc = {
  pid: number;
  name: string;
  detail: string;
  memory: number;
  ports: number[];
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
  warning: string | null;
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

export type SortKey = "port" | "name" | "memory" | "pid" | "family";
export type Sort = { key: SortKey; dir: 1 | -1 };

/**
 * Memory and group read descending by default — you open memory to find the
 * biggest hog, and group to find the processes that belong to something.
 */
export const defaultDir = (key: SortKey): 1 | -1 =>
  key === "memory" || key === "family" ? -1 : 1;

export const mb = (bytes: number) =>
  bytes >= 1_073_741_824
    ? `${(bytes / 1_073_741_824).toFixed(1)} GB`
    : `${Math.round(bytes / 1_048_576)} MB`;

/** Thresholds offered for the heavy-process marker, in MB. */
export const THRESHOLDS = [100, 250, 500, 1000, 2000];

export const thresholdLabel = (mb: number) =>
  mb >= 1000 ? `${mb / 1000} GB` : `${mb} MB`;
