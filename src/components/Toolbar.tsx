import { DownloadIcon, MoonIcon, RefreshIcon, SunIcon } from "../icons";
import type { Theme } from "../theme";

/** Thresholds offered for the heavy-process marker, in MB. */
const THRESHOLDS = [100, 250, 500, 1000, 2000];

export function Toolbar({
  theme,
  onTheme,
  onRefresh,
  format,
  onFormat,
  onExport,
  memoryWarnMb,
  onMemoryWarnMb,
}: {
  theme: Theme;
  onTheme: (t: Theme) => void;
  onRefresh: () => void;
  format: "json" | "csv";
  onFormat: (f: "json" | "csv") => void;
  onExport: () => void;
  memoryWarnMb: number;
  onMemoryWarnMb: (mb: number) => void;
}) {
  return (
    <header className="toolbar">
      <h1 className="wordmark">
        portiye<span className="wordmark__dot">.</span>
      </h1>

      <div className="toolbar__spacer" />

      <label className="toolbar__setting">
        Flag over
        <select
          className="select"
          value={memoryWarnMb}
          onChange={(e) => onMemoryWarnMb(Number(e.target.value))}
          aria-label="Flag processes using more memory than"
        >
          {THRESHOLDS.map((n) => (
            <option key={n} value={n}>
              {n >= 1000 ? `${n / 1000} GB` : `${n} MB`}
            </option>
          ))}
        </select>
      </label>

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
