import { DownloadIcon, MoonIcon, RefreshIcon, SunIcon } from "../icons";
import type { Theme } from "../theme";

export type View = "ports" | "history" | "logs";
const VIEWS: { id: View; label: string }[] = [
  { id: "ports", label: "Ports" },
  { id: "history", label: "History" },
  { id: "logs", label: "Device Logs" },
];

export function Toolbar({
  view,
  onView,
  theme,
  onTheme,
  onRefresh,
  format,
  onFormat,
  onExport,
}: {
  view: View;
  onView: (v: View) => void;
  theme: Theme;
  onTheme: (t: Theme) => void;
  onRefresh: () => void;
  format: "json" | "csv";
  onFormat: (f: "json" | "csv") => void;
  onExport: () => void;
}) {
  return (
    <header className="toolbar">
      <h1 className="wordmark">
        portiye<span className="wordmark__dot">.</span>
      </h1>

      {/* Radio semantics: exactly one view is active, and arrow keys move
          between them the way a tab strip should. */}
      <div className="tabs" role="tablist" aria-label="View">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            role="tab"
            className="tab"
            aria-selected={view === v.id}
            data-active={view === v.id || undefined}
            onClick={() => onView(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="toolbar__spacer" />

      {/* Export acts on the port table, so it only exists while it is on
          screen. */}
      {view === "ports" && (
        <>
          {/* A native select rather than a menu: two formats do not justify a
              popover, and this stays keyboard-navigable for free. */}
          <div className="toolbar__group">
            <select
              className="select"
              value={format}
              onChange={(e) => onFormat(e.target.value as "json" | "csv")}
              aria-label="Export format"
            >
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
            </select>
            <button
              className="btn"
              onClick={onExport}
              title="Export the current table to your Downloads folder (⌘E)"
            >
              <DownloadIcon />
              Export
            </button>
          </div>
        </>
      )}

      <button
        className="btn btn--icon"
        onClick={onRefresh}
        aria-label="Refresh now"
        title="Refresh now (⌘R)"
      >
        <RefreshIcon />
      </button>

      <button
        className="btn btn--icon"
        onClick={() => onTheme(theme === "dark" ? "light" : "dark")}
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      >
        {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      </button>
    </header>
  );
}
