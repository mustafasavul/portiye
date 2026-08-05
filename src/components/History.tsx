import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export type PortEvent = {
  at: number;
  kind: "opened" | "closed" | "taken";
  port: number;
  pid: number;
  name: string;
  detail: string;
  previous: string | null;
};

const time = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** "3m ago" beats a bare clock for anything inside the last hour. */
function ago(at: number, now: number) {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return time.format(at);
}

/**
 * How many rows to paint at once. The buffer holds 500; drawing all of them on
 * mount was a ~150ms freeze on every switch to this tab, and nobody reads past
 * the first screen anyway.
 */
const PAGE = 100;

/**
 * What opened and closed, newest first. The events come from the Rust watcher,
 * which keeps polling while the window is shut — so this fills in even when
 * nobody is looking.
 */
export function History({ revision }: { revision: number }) {
  const [events, setEvents] = useState<PortEvent[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    invoke<PortEvent[]>("get_port_history").then(setEvents).catch(() => {});
    setNow(Date.now());
  }, [revision]);

  // Relative labels go stale on their own; nothing else here ticks.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="panel panel--fill">
      <div className="panel__head">
        <h2 className="panel__title">Port history</h2>
        <button
          className="btn"
          disabled={events.length === 0}
          onClick={() =>
            invoke("clear_port_history").then(() => setEvents([]))
          }
        >
          Clear
        </button>
        <span className="panel__count">{events.length}</span>
      </div>

      <div className="panel__scroll">
        {events.length === 0 ? (
          <p className="empty">
            Nothing has opened or closed since portiye started. Events appear
            here as they happen, including while the window is closed.
          </p>
        ) : (
          <ul className="events">
            {events.slice(0, limit).map((e, i) => (
              <li className="event" key={`${e.at}-${e.pid}-${e.port}-${i}`}>
                <span className={`event__kind event__kind--${e.kind}`}>
                  {e.kind === "opened" ? "▲" : e.kind === "closed" ? "▼" : "⚠"}
                </span>
                <span className="event__port">:{e.port}</span>
                <span className="event__text">
                  <span className="event__name">
                    {e.name}
                    {e.kind === "taken" && e.previous && (
                      <span className="event__from"> took over from {e.previous}</span>
                    )}
                  </span>
                  {e.detail && <span className="event__detail">{e.detail}</span>}
                </span>
                <span className="event__pid">{e.pid}</span>
                <span className="event__at" title={time.format(e.at)}>
                  {ago(e.at, now)}
                </span>
              </li>
            ))}
            {events.length > limit && (
              <li className="event event--more">
                <button
                  className="btn"
                  onClick={() => setLimit((n) => n + PAGE)}
                >
                  Show {Math.min(PAGE, events.length - limit)} older
                </button>
                <span className="event__at">
                  {events.length - limit} more
                </span>
              </li>
            )}
          </ul>
        )}
      </div>
    </section>
  );
}
