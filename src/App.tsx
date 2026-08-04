import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type PortEntry = {
  pid: number;
  port: number;
  name: string;
  detail: string;
  memory: number;
};

const mb = (bytes: number) =>
  bytes >= 1_073_741_824
    ? `${(bytes / 1_073_741_824).toFixed(1)} GB`
    : `${Math.round(bytes / 1_048_576)} MB`;
type Simulator = { udid: string; name: string; state: string; runtime: string };
type Avd = { name: string; serial: string | null };

export default function App() {
  const [avds, setAvds] = useState<Avd[]>([]);
  const [ports, setPorts] = useState<PortEntry[]>([]);
  const [sims, setSims] = useState<Simulator[]>([]);
  const [showAllSims, setShowAllSims] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [a, p, s] = await Promise.all([
        invoke<Avd[]>("list_avds"),
        invoke<PortEntry[]>("get_listening_ports"),
        invoke<Simulator[]>("list_simulators"),
      ]);
      setAvds(a);
      setPorts(p);
      setSims(s);
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

  const avdAction = async (avd: Avd, wipe = false) => {
    if (
      wipe &&
      !confirm(
        `Wipe "${avd.name.replace(/_/g, " ")}"?\n` +
          "All apps, data and snapshots are erased, then it cold boots.",
      )
    )
      return;
    setBusy(avd.name);
    try {
      if (wipe) await invoke("wipe_avd", { name: avd.name, serial: avd.serial });
      else if (avd.serial) await invoke("stop_avd", { serial: avd.serial });
      else await invoke("launch_avd", { name: avd.name });
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  // One handler for boot/shutdown/erase — same shape, only the command differs.
  const simAction = async (cmd: string, sim: Simulator) => {
    if (
      cmd === "erase_simulator" &&
      !confirm(`Erase "${sim.name}"?\nAll apps, data and caches are wiped.`)
    )
      return;
    setBusy(sim.udid);
    try {
      await invoke(cmd, { udid: sim.udid });
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  const kill = async (pid: number) => {
    try {
      await invoke("kill_process", { pid });
      refresh();
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <header className="flex items-baseline justify-between mb-6">
        <h1 className="text-xl font-semibold tracking-tight">portiye</h1>
        <button
          onClick={refresh}
          className="text-xs text-zinc-400 hover:text-zinc-100 transition"
        >
          Refresh
        </button>
      </header>

      {error && (
        <p className="mb-4 rounded-lg bg-red-950/60 border border-red-900 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-xs uppercase tracking-widest text-zinc-500">
          Android emulators
        </h2>
        {avds.length === 0 ? (
          <Empty>No AVDs found. Create one in Android Studio.</Empty>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {avds.map((avd) => (
              <li
                key={avd.name}
                className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 hover:border-zinc-700 transition"
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    avd.serial ? "bg-emerald-400" : "bg-zinc-700"
                  }`}
                />
                <span className="flex-1 truncate text-sm">
                  {avd.name.replace(/_/g, " ")}
                  {avd.serial && (
                    <span className="ml-2 text-xs text-zinc-500">{avd.serial}</span>
                  )}
                </span>
                <button
                  disabled={busy === avd.name}
                  onClick={() => avdAction(avd)}
                  className={`rounded-lg px-3 py-1 text-xs font-medium disabled:opacity-50 transition ${
                    avd.serial
                      ? "border border-zinc-700 hover:bg-zinc-800"
                      : "bg-emerald-600 hover:bg-emerald-500"
                  }`}
                >
                  {busy === avd.name ? "…" : avd.serial ? "Stop" : "Launch"}
                </button>
                <button
                  disabled={busy === avd.name}
                  onClick={() => avdAction(avd, true)}
                  className="rounded-lg border border-red-900 px-2 py-1 text-xs text-red-300 hover:bg-red-900/40 disabled:opacity-50 transition"
                >
                  Wipe
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xs uppercase tracking-widest text-zinc-500">
            iOS simulators
          </h2>
          {sims.length > 0 && (
            <button
              onClick={() => setShowAllSims((v) => !v)}
              className="text-xs text-zinc-500 hover:text-zinc-200 transition"
            >
              {showAllSims ? "Only running" : `Show all (${sims.length})`}
            </button>
          )}
        </div>
        {(() => {
          const visible = showAllSims
            ? sims
            : sims.filter((s) => s.state === "Booted");
          if (visible.length === 0)
            return (
              <Empty>
                {sims.length === 0
                  ? "No simulators (Xcode not installed?)."
                  : "No running simulators."}
              </Empty>
            );
          return (
            <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800 overflow-hidden">
              {visible.map((s) => {
                const booted = s.state === "Booted";
                return (
                  <li
                    key={s.udid}
                    className="flex items-center gap-3 bg-zinc-900/40 px-4 py-2 text-sm"
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        booted ? "bg-emerald-400" : "bg-zinc-700"
                      }`}
                    />
                    <span className="flex-1 truncate">{s.name}</span>
                    <span className="text-xs text-zinc-500">{s.runtime}</span>
                    <button
                      disabled={busy === s.udid}
                      onClick={() =>
                        simAction(
                          booted ? "shutdown_simulator" : "boot_simulator",
                          s,
                        )
                      }
                      className="rounded-lg border border-zinc-700 px-2 py-0.5 text-xs hover:bg-zinc-800 disabled:opacity-50 transition"
                    >
                      {booted ? "Shutdown" : "Boot"}
                    </button>
                    <button
                      disabled={busy === s.udid}
                      onClick={() => simAction("erase_simulator", s)}
                      className="rounded-lg border border-red-900 px-2 py-0.5 text-xs text-red-300 hover:bg-red-900/40 disabled:opacity-50 transition"
                    >
                      Erase
                    </button>
                  </li>
                );
              })}
            </ul>
          );
        })()}
      </section>

      <section>
        <h2 className="mb-3 text-xs uppercase tracking-widest text-zinc-500">
          Listening ports
        </h2>
        {ports.length === 0 ? (
          <Empty>Nothing listening.</Empty>
        ) : (
          <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800 overflow-hidden">
            {ports.map((p) => (
              <li
                key={`${p.pid}:${p.port}`}
                className="flex items-center gap-3 bg-zinc-900/40 px-4 py-2 text-sm"
              >
                <span className="w-16 shrink-0 font-mono text-emerald-400">
                  :{p.port}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{p.name}</span>
                  {p.detail && (
                    <span className="block truncate text-xs text-zinc-500">
                      {p.detail}
                    </span>
                  )}
                </span>
                <span className="w-16 shrink-0 text-right font-mono text-xs text-zinc-400">
                  {mb(p.memory)}
                </span>
                <span className="font-mono text-xs text-zinc-600">{p.pid}</span>
                <button
                  onClick={() => kill(p.pid)}
                  className="rounded-lg border border-red-900 px-2 py-0.5 text-xs text-red-300 hover:bg-red-900/40 transition"
                >
                  Kill
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-zinc-800 px-4 py-6 text-center text-sm text-zinc-500">
      {children}
    </p>
  );
}
