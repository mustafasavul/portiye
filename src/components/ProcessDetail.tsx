import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CloseIcon } from "../icons";
import { mb } from "../types";

type Relative = { pid: number; name: string };

type Detail = {
  pid: number;
  name: string;
  command: string;
  cwd: string;
  user: string;
  memory: number;
  cpu: number;
  uptime: number;
  ancestors: Relative[];
  children: Relative[];
  open_files: number;
  files_sample: string[];
  connections: string[];
  lsof_error: string | null;
};

function duration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400)
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86_400)}d`;
}

/**
 * Everything about one process, fetched on open.
 *
 * The `lsof` calls behind this are far too slow for the poll loop, so opening
 * the panel is what pays for them — and it re-fetches only when asked.
 */
export function ProcessDetail({
  pid,
  onClose,
  onKill,
}: {
  pid: number;
  onClose: () => void;
  onKill: () => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setDetail(null);
    setError(null);
    invoke<Detail>("process_detail", { pid })
      .then((d) => live && setDetail(d))
      .catch((e) => live && setError(String(e)));
    // The panel can be closed, or another row picked, before this resolves.
    return () => {
      live = false;
    };
  }, [pid]);

  return (
    <aside className="detail" aria-label={`Details for process ${pid}`}>
      <div className="detail__head">
        <h2 className="detail__title">{detail?.name ?? `pid ${pid}`}</h2>
        <button className="btn btn--icon" onClick={onClose} aria-label="Close details">
          <CloseIcon />
        </button>
      </div>

      <div className="detail__body">
        {error && <p className="empty">{error}</p>}
        {!detail && !error && <p className="empty">Reading…</p>}

        {detail && (
          <>
            <dl className="facts">
              <dt>PID</dt>
              <dd>{detail.pid}</dd>
              <dt>CPU</dt>
              <dd>{detail.cpu.toFixed(1)}%</dd>
              <dt>Memory</dt>
              <dd>{mb(detail.memory)}</dd>
              <dt>Uptime</dt>
              <dd>{duration(detail.uptime)}</dd>
              {detail.user && (
                <>
                  <dt>User</dt>
                  <dd>{detail.user}</dd>
                </>
              )}
              {detail.cwd && (
                <>
                  <dt>Directory</dt>
                  <dd className="facts__wrap">{detail.cwd}</dd>
                </>
              )}
            </dl>

            {detail.command && (
              <>
                <h3 className="detail__section">Command</h3>
                <pre className="detail__pre">{detail.command}</pre>
              </>
            )}

            <h3 className="detail__section">Process tree</h3>
            <ul className="tree">
              {detail.ancestors.map((a, i) => (
                <li key={a.pid} style={{ paddingLeft: `${i}rem` }}>
                  <span className="tree__name">{a.name}</span>
                  <span className="tree__pid">{a.pid}</span>
                </li>
              ))}
              <li
                className="tree__self"
                style={{ paddingLeft: `${detail.ancestors.length}rem` }}
              >
                <span className="tree__name">{detail.name}</span>
                <span className="tree__pid">{detail.pid}</span>
              </li>
              {detail.children.map((c) => (
                <li
                  key={c.pid}
                  style={{ paddingLeft: `${detail.ancestors.length + 1}rem` }}
                >
                  <span className="tree__name">{c.name}</span>
                  <span className="tree__pid">{c.pid}</span>
                </li>
              ))}
            </ul>

            <h3 className="detail__section">
              Connections
              <span className="detail__count">{detail.connections.length}</span>
            </h3>
            {detail.lsof_error ? (
              // Saying why beats an empty list that reads as "none".
              <p className="empty">{detail.lsof_error}</p>
            ) : detail.connections.length === 0 ? (
              <p className="empty">No open sockets.</p>
            ) : (
              <ul className="mono-list">
                {detail.connections.map((c, i) => (
                  <li key={`${c}-${i}`}>{c}</li>
                ))}
              </ul>
            )}

            <h3 className="detail__section">
              Open files
              <span className="detail__count">{detail.open_files}</span>
            </h3>
            {detail.files_sample.length === 0 ? (
              <p className="empty">No regular files open.</p>
            ) : (
              <ul className="mono-list">
                {detail.files_sample.map((f, i) => (
                  <li key={`${f}-${i}`}>{f}</li>
                ))}
                {detail.open_files > detail.files_sample.length && (
                  <li className="mono-list__more">
                    and {detail.open_files - detail.files_sample.length} more
                  </li>
                )}
              </ul>
            )}
          </>
        )}
      </div>

      <div className="detail__foot">
        <button className="btn btn--solid-danger" onClick={onKill}>
          Kill this process
        </button>
      </div>
    </aside>
  );
}
