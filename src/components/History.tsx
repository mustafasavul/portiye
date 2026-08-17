import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useI18n, type Key, type T } from "../i18n";

export type PortEvent = {
  at: number;
  kind: "opened" | "closed" | "taken";
  port: number;
  pid: number;
  name: string;
  detail: string;
  previous: string | null;
};

/** Locale-aware, so the clock reads the way the rest of the app does. */
const timeFormat = (locale: string) =>
  new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

/** "3m ago" beats a bare clock for anything inside the last hour. */
function ago(at: number, now: number, t: T, time: Intl.DateTimeFormat) {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return t("history.secondsAgo", { n: s });
  if (s < 3600) return t("history.minutesAgo", { n: Math.round(s / 60) });
  return time.format(at);
}

/**
 * How many rows to paint at once. The buffer holds 500; drawing all of them on
 * mount was a ~150ms freeze on every switch to this tab, and nobody reads past
 * the first screen anyway.
 */
const PAGE = 100;

const KINDS: { id: PortEvent["kind"] | "all"; label: Key }[] = [
  { id: "all", label: "history.all" },
  { id: "opened", label: "history.opened" },
  { id: "closed", label: "history.closed" },
  { id: "taken", label: "history.taken" },
];

/**
 * What opened and closed, newest first. The events come from the Rust watcher,
 * which keeps polling while the window is shut — so this fills in even when
 * nobody is looking.
 */
export function History({ revision }: { revision: number }) {
  const { t, locale } = useI18n();
  const time = useMemo(() => timeFormat(locale), [locale]);
  const [events, setEvents] = useState<PortEvent[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [limit, setLimit] = useState(PAGE);
  const [kind, setKind] = useState<PortEvent["kind"] | "all">("all");
  const [query, setQuery] = useState("");

  // Same filtering rule as the port table: one box over port, process and
  // path, because that is the one people already know how to use here.
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter(
      (e) =>
        (kind === "all" || e.kind === kind) &&
        (!q || `${e.port} ${e.name} ${e.detail}`.toLowerCase().includes(q)),
    );
  }, [events, kind, query]);

  // A filter narrowed to nothing must not also hide the "show older" button
  // behind a stale page size.
  useEffect(() => setLimit(PAGE), [kind, query]);

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
      <div className="panel__head panel__head--tools">
        <h2 className="panel__title">{t("history.title")}</h2>
        <button
          className="btn"
          disabled={events.length === 0}
          onClick={() =>
            invoke("clear_port_history").then(() => setEvents([]))
          }
        >
          {t("history.clear")}
        </button>

        {/* Four buttons rather than a select: the counts are the point, and a
            closed picker hides them. */}
        <div className="tabs" role="group" aria-label={t("history.kind")}>
          {KINDS.map((k) => (
            <button
              key={k.id}
              className="tab"
              data-active={kind === k.id || undefined}
              aria-pressed={kind === k.id}
              onClick={() => setKind(k.id)}
            >
              {t(k.label)}
              <span className="tab__count">
                {k.id === "all"
                  ? events.length
                  : events.filter((e) => e.kind === k.id).length}
              </span>
            </button>
          ))}
        </div>

        <div className="field">
          <input
            className="field__input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("history.filter")}
            aria-label={t("history.filterAria")}
          />
        </div>

        <span className="panel__count">
          {shown.length === events.length
            ? events.length
            : `${shown.length} / ${events.length}`}
        </span>
      </div>

      {/* The columns were unlabelled: a bare 616 beside a port number is only
          a PID once someone tells you it is. */}
      {events.length > 0 && (
        <div className="events__head">
          <span className="event__kind">{t("history.event")}</span>
          <span className="event__port">{t("table.port")}</span>
          <span className="event__text">{t("table.process")}</span>
          <span className="event__pid">{t("table.pid")}</span>
          <span className="event__at">{t("history.when")}</span>
        </div>
      )}

      <div className="panel__scroll">
        {shown.length === 0 ? (
          <p className="empty">
            {events.length === 0 ? t("history.empty") : t("history.emptyFilter")}
          </p>
        ) : (
          <ul className="events">
            {shown.slice(0, limit).map((e, i) => (
              <li className="event" key={`${e.at}-${e.pid}-${e.port}-${i}`}>
                <span className={`event__kind event__kind--${e.kind}`}>
                  {e.kind === "opened" ? "▲" : e.kind === "closed" ? "▼" : "⚠"}
                </span>
                <span className="event__port">:{e.port}</span>
                <span className="event__text">
                  <span className="event__name">
                    {e.name}
                    {e.kind === "taken" && e.previous && (
                      <span className="event__from">
                        {" "}
                        {t("history.tookOver", { name: e.previous })}
                      </span>
                    )}
                  </span>
                  {e.detail && <span className="event__detail">{e.detail}</span>}
                </span>
                <span className="event__pid">{e.pid}</span>
                <span className="event__at" title={time.format(e.at)}>
                  {ago(e.at, now, t, time)}
                </span>
              </li>
            ))}
            {shown.length > limit && (
              <li className="event event--more">
                <button
                  className="btn"
                  onClick={() => setLimit((n) => n + PAGE)}
                >
                  {t("history.showOlder", {
                    n: Math.min(PAGE, shown.length - limit),
                  })}
                </button>
                <span className="event__at">
                  {t("history.more", { n: shown.length - limit })}
                </span>
              </li>
            )}
          </ul>
        )}
      </div>
    </section>
  );
}
