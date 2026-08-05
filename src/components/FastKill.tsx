import { mb } from "../types";
import type { KillGroup } from "../types";

/**
 * One button per process name — or per language runtime — holding more than
 * one listener. The verb leads in a filled red lozenge so the button reads as
 * an action, not a tag; the amber triangle is a separate signal for risk.
 */
export function FastKill({
  groups,
  busy,
  onKill,
}: {
  groups: KillGroup[];
  busy: string | null;
  onKill: (g: KillGroup) => void;
}) {
  if (groups.length === 0) return null;

  return (
    <div className="fastkill">
      {groups.map((g) => {
        const id = `fast:${g.kind}:${g.name}`;
        return (
          <button
            key={id}
            className={g.warning ? "chip chip--warn" : "chip"}
            disabled={busy === id}
            aria-busy={busy === id}
            onClick={() => onKill(g)}
            title={
              g.warning ??
              (g.kind === "runtime"
                ? `Kill every ${g.name} process: ${[
                    ...new Set(g.procs.map((p) => p.name)),
                  ].join(", ")}`
                : `Kill all ${g.procs.length} ${g.name} processes`)
            }
          >
            <span className="chip__verb">Kill {g.procs.length}</span>
            {g.warning && (
              <span className="chip__warn" aria-hidden="true">
                ⚠
              </span>
            )}
            <span className="chip__name">{g.name}</span>
            {g.kind === "runtime" && <span className="chip__kind">runtime</span>}
            <span className="chip__mem">{mb(g.memory)}</span>
          </button>
        );
      })}
    </div>
  );
}
