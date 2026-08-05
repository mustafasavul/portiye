import { useState } from "react";
import { runtimeOf } from "../runtime";
import { mb } from "../types";
import type { Proc } from "../types";

/**
 * A saved kill. Deliberately *not* an automatic rule: it matches on demand and
 * always routes through the confirmation, so a sweep written too broadly can
 * never quietly take out a database at 3am.
 */
export type Sweep = {
  name: string;
  /** Any of these matches: exact process names. */
  names: string[];
  /** Any of these matches: language runtimes. */
  runtimes: string[];
  /** Substring of the detail line — the project or app a process belongs to. */
  detailContains: string;
};

/** Everything a sweep would hit right now. Empty rules match nothing. */
export function matchSweep(sweep: Sweep, procs: Proc[]): Proc[] {
  const names = sweep.names.map((n) => n.toLowerCase()).filter(Boolean);
  const runtimes = sweep.runtimes.filter(Boolean);
  const needle = sweep.detailContains.trim().toLowerCase();
  if (names.length === 0 && runtimes.length === 0 && !needle) return [];

  return procs.filter((p) => {
    // Every stated criterion must hold, so adding one always narrows.
    if (names.length > 0 && !names.includes(p.name.toLowerCase())) return false;
    if (runtimes.length > 0) {
      const r = runtimeOf(p.name);
      if (!r || !runtimes.includes(r)) return false;
    }
    if (needle && !p.detail.toLowerCase().includes(needle)) return false;
    return true;
  });
}

export function Sweeps({
  sweeps,
  procs,
  busy,
  onRun,
  onRemove,
  onSave,
  suggestion,
}: {
  sweeps: Sweep[];
  procs: Proc[];
  busy: string | null;
  onRun: (s: Sweep, matched: Proc[]) => void;
  onRemove: (name: string) => void;
  onSave: (s: Sweep) => void;
  /** Pre-filled from what is selected or filtered right now. */
  suggestion: Omit<Sweep, "name">;
}) {
  // Inline, not a dialog: `prompt` is as unusable as `confirm` in the Tauri
  // webview, and the rule is easier to judge next to the list it will hit.
  const [draft, setDraft] = useState<Sweep | null>(null);

  return (
    <section className="panel">
      <div className="panel__head">
        <h2 className="panel__title">Sweeps</h2>
        <button
          className="btn"
          disabled={draft !== null}
          onClick={() => setDraft({ name: "", ...suggestion })}
        >
          New sweep
        </button>
        <span className="panel__count">{sweeps.length}</span>
      </div>
      <div className="panel__body">
        {draft && (
          <form
            className="draft"
            onSubmit={(e) => {
              e.preventDefault();
              const name = draft.name.trim();
              if (!name || matchSweep(draft, procs).length === 0) return;
              onSave({ ...draft, name });
              setDraft(null);
            }}
          >
            <input
              className="field__input"
              autoFocus
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Sweep name, e.g. IDE helpers"
              aria-label="Sweep name"
            />
            <span className="draft__rule">
              {describe({ ...draft, name: "" })} — matches{" "}
              {matchSweep(draft, procs).length} now
            </span>
            <span className="draft__actions">
              <button className="btn" type="button" onClick={() => setDraft(null)}>
                Cancel
              </button>
              <button
                className="btn btn--primary"
                type="submit"
                disabled={
                  !draft.name.trim() || matchSweep(draft, procs).length === 0
                }
              >
                Save
              </button>
            </span>
          </form>
        )}

        {sweeps.length === 0 && !draft ? (
          <p className="empty">
            A sweep is a saved kill you can re-run in one click — “everything my
            IDE spawned”, “all my Node servers”. It always asks before killing.
          </p>
        ) : (
          <ul className="sweeps">
            {sweeps.map((s) => {
              const matched = matchSweep(s, procs);
              const id = `sweep:${s.name}`;
              const total = matched.reduce((n, p) => n + p.memory, 0);
              return (
                <li className="sweep" key={s.name}>
                  <span className="sweep__text">
                    <span className="sweep__name">{s.name}</span>
                    <span className="sweep__rule">{describe(s)}</span>
                  </span>
                  <button
                    className="chip"
                    disabled={matched.length === 0 || busy === id}
                    aria-busy={busy === id}
                    onClick={() => onRun(s, matched)}
                    title={
                      matched.length === 0
                        ? "Nothing matches this sweep right now"
                        : matched.map((p) => `${p.name} (${p.pid})`).join("\n")
                    }
                  >
                    <span className="chip__verb">Kill {matched.length}</span>
                    {matched.length > 0 && (
                      <span className="chip__mem">{mb(total)}</span>
                    )}
                  </button>
                  <button
                    className="btn btn--icon"
                    onClick={() => onRemove(s.name)}
                    aria-label={`Delete the ${s.name} sweep`}
                    title="Delete this sweep"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function describe(s: Sweep) {
  const parts = [
    s.names.length > 0 && `name: ${s.names.join(", ")}`,
    s.runtimes.length > 0 && `runtime: ${s.runtimes.join(", ")}`,
    s.detailContains && `from: ${s.detailContains}`,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "matches nothing";
}
