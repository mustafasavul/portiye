import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { CloseIcon } from "../icons";
import { useT } from "../i18n";
import type { Device } from "../types";

/** Lines kept in memory. Beyond this the oldest are dropped. */
const CAP = 2000;

/**
 * Live device logs — `simctl log stream` for iOS, `adb logcat` for Android.
 *
 * ponytail: a plain list, no virtualisation. 2000 rows of text is nothing for
 * the DOM; reach for `react-window` only if the cap ever needs to grow.
 */
export function LogView({ devices }: { devices: Device[] }) {
  const t = useT();
  const [source, setSource] = useState<string>("");
  const [lines, setLines] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [follow, setFollow] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Only running devices have anything to stream.
  const streamable = devices.filter(
    (d) => d.running && (d.id.startsWith("sim:") || d.id.startsWith("avd:")),
  );

  useEffect(() => {
    const un = listen<string>("log-line", (e) =>
      setLines((prev) => {
        const next = prev.length >= CAP ? prev.slice(prev.length - CAP + 1) : prev;
        return [...next, e.payload];
      }),
    );
    return () => {
      un.then((f) => f());
    };
  }, []);

  // Whatever is streaming must stop when this panel goes away, or the child
  // process outlives the view that asked for it.
  useEffect(() => () => void invoke("stop_logs").catch(() => {}), []);

  const start = async (id: string) => {
    setError(null);
    setNotice(null);
    setLines([]);
    setSource(id);
    if (!id) {
      await invoke("stop_logs").catch(() => {});
      return;
    }
    try {
      // Android serials arrive as `avd:<name>`; the stream needs the serial.
      await invoke("start_logs", { id });
    } catch (e) {
      setError(String(e));
      setSource("");
    }
  };

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? lines.filter((l) => l.toLowerCase().includes(q)) : lines;
  }, [lines, filter]);

  useEffect(() => {
    // Scrolling out from under a selection cancels it, so following yields to
    // whatever the user is dragging over right now.
    const sel = window.getSelection();
    const selecting =
      sel &&
      !sel.isCollapsed &&
      boxRef.current?.contains(sel.anchorNode as Node | null);
    if (follow && !selecting && boxRef.current)
      boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [shown, follow]);

  const stamp = () => new Date().toISOString().slice(0, 19);

  /** Whatever is on screen — the filter is part of what you asked for. */
  const copy = async () => {
    const text = shown.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setNotice(t("logs.copied", { n: shown.length }));
    } catch {
      // The async clipboard needs a permission the webview does not always
      // grant; the selection-based path is older and asks for nothing.
      setNotice(
        legacyCopy(text)
          ? t("logs.copied", { n: shown.length })
          : t("logs.copyFailed"),
      );
    }
  };

  const exportLines = async () => {
    try {
      const path = await invoke<string>("export_logs", {
        lines: shown,
        source: source || "logs",
        stamp: stamp(),
      });
      setNotice(t("logs.exported", { n: shown.length, path }));
    } catch (e) {
      setNotice(String(e));
    }
  };

  return (
    <section className="panel panel--fill">
      <div className="panel__head panel__head--tools">
        <h2 className="panel__title">{t("logs.title")}</h2>

        <select
          className="select"
          value={source}
          onChange={(e) => start(e.target.value)}
          aria-label={t("logs.source")}
        >
          <option value="">{t("logs.off")}</option>
          {streamable.map((d) => (
            <option key={d.id} value={logId(d)}>
              {d.name}
            </option>
          ))}
        </select>

        <div className="field">
          <input
            className="field__input"
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("logs.filter")}
            aria-label={t("logs.filterAria")}
          />
        </div>

        <label className="toolbar__setting">
          <input
            type="checkbox"
            className="pick"
            checked={follow}
            onChange={(e) => setFollow(e.target.checked)}
          />
          {t("logs.follow")}
        </label>

        <button className="btn" disabled={shown.length === 0} onClick={copy}>
          {t("logs.copy")}
        </button>
        <button
          className="btn"
          disabled={shown.length === 0}
          onClick={exportLines}
          title={t("logs.exportTitle")}
        >
          {t("logs.export")}
        </button>

        <span className="panel__count">
          {filter ? `${shown.length} / ${lines.length}` : lines.length}
        </span>
      </div>

      {notice && (
        <p className="banner banner--ok" role="status">
          <span className="banner__text">{notice}</span>
          <button
            className="btn btn--icon"
            onClick={() => setNotice(null)}
            aria-label={t("banner.dismiss")}
          >
            <CloseIcon />
          </button>
        </p>
      )}

      <div className="panel__scroll logs" ref={boxRef}>
        {error && <p className="empty">{error}</p>}
        {!error && streamable.length === 0 && (
          <p className="empty">
            {t("logs.emptyNoDevice")}
          </p>
        )}
        {!error && streamable.length > 0 && !source && (
          <p className="empty">{t("logs.emptyPick")}</p>
        )}
        {shown.map((l, i) => (
          <div className="logline" key={i}>
            {l}
          </div>
        ))}
      </div>
    </section>
  );
}

/** `execCommand` is deprecated, and still the only copy WKWebView never blocks. */
function legacyCopy(text: string) {
  const box = document.createElement("textarea");
  box.value = text;
  box.style.position = "fixed";
  box.style.opacity = "0";
  document.body.append(box);
  box.select();
  const ok = document.execCommand("copy");
  box.remove();
  return ok;
}

/**
 * The Rust side wants `avd:<serial>`, but an Android device's id carries its
 * AVD name — the serial lives in `meta` once it is running.
 */
function logId(d: Device) {
  return d.id.startsWith("avd:") ? `avd:${d.meta}` : d.id;
}
