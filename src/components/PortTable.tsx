import { SortArrowIcon } from "../icons";
import { defaultDir, mb } from "../types";
import type { Family, Proc, Sort, SortKey } from "../types";

export function PortTable({
  families,
  sort,
  onSort,
  selected,
  onToggleSelect,
  onToggleAll,
  memoryWarn,
  busy,
  onKill,
}: {
  families: Family[];
  sort: Sort;
  onSort: (k: SortKey) => void;
  selected: Set<number>;
  onToggleSelect: (pid: number) => void;
  onToggleAll: () => void;
  /** Bytes above which a row is flagged as heavy. */
  memoryWarn: number;
  busy: string | null;
  onKill: (proc: Proc) => void;
}) {
  const rows = families.flatMap((f) =>
    [f.root, ...f.children].map((proc, i) => ({ proc, child: i > 0 })),
  );
  const allSelected =
    rows.length > 0 && rows.every((r) => selected.has(r.proc.pid));
  // Distinct from "all": the header box shows a dash rather than a tick.
  const someSelected = !allSelected && rows.some((r) => selected.has(r.proc.pid));

  return (
    <>
      <div className="ports__head">
        <span className="port__pick">
          <input
            type="checkbox"
            className="pick"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
            }}
            onChange={onToggleAll}
            aria-label={allSelected ? "Clear selection" : "Select all shown"}
          />
        </span>
        <span className="port__number">
          <SortHead sort={sort} onSort={onSort} k="port">
            Port
          </SortHead>
        </span>
        <span className="port__text">
          <SortHead sort={sort} onSort={onSort} k="name">
            Process
          </SortHead>
        </span>
        <span className="port__mem">
          <SortHead sort={sort} onSort={onSort} k="memory">
            Memory
          </SortHead>
        </span>
        <span className="port__pid">
          <SortHead sort={sort} onSort={onSort} k="pid">
            PID
          </SortHead>
        </span>
        <span className="port__action" aria-hidden="true" />
      </div>

      <ul className="ports">
        {rows.map(({ proc, child }) => (
          <ProcRow
            key={proc.pid}
            proc={proc}
            child={child}
            selected={selected.has(proc.pid)}
            onSelect={() => onToggleSelect(proc.pid)}
            hot={proc.memory >= memoryWarn}
            busy={busy === `port:${proc.pid}`}
            onKill={() => onKill(proc)}
          />
        ))}
      </ul>
    </>
  );
}

/**
 * One process. Extra ports collapse into a `+n` chip rather than repeating the
 * row, so the fixed column widths stay aligned with the header.
 */
function ProcRow({
  proc,
  child,
  selected,
  onSelect,
  hot,
  busy,
  onKill,
}: {
  proc: Proc;
  child: boolean;
  selected: boolean;
  onSelect: () => void;
  hot: boolean;
  busy: boolean;
  onKill: () => void;
}) {
  const [first, ...rest] = proc.ports;
  const allPorts = proc.ports.map((p) => `:${p}`).join(", ");

  return (
    <li
      className={[
        "port",
        child && "port--child",
        selected && "port--selected",
        hot && "port--hot",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="port__pick">
        <input
          type="checkbox"
          className="pick"
          checked={selected}
          onChange={onSelect}
          aria-label={`Select ${proc.name}, pid ${proc.pid}`}
        />
      </span>
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
      <span className="port__mem">
        {mb(proc.memory)}
        {/* The threshold is a user setting, so the marker explains itself
            rather than leaving a bare colour to be decoded. */}
        {hot && (
          <span className="port__hot" title="Above your memory threshold">
            ⚠
          </span>
        )}
      </span>
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
export function SortHead({
  sort,
  onSort,
  k,
  children,
}: {
  sort: Sort;
  onSort: (k: SortKey) => void;
  k: SortKey;
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
  );
}
