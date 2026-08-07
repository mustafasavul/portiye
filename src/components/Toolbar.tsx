import { useEffect, useState } from "react";
import {
  disable as disableAutostart,
  enable as enableAutostart,
  isEnabled as autostartEnabled,
} from "@tauri-apps/plugin-autostart";
import { DownloadIcon, MoonIcon, RefreshIcon, SunIcon } from "../icons";
import { LOCALES, useI18n, type Locale } from "../i18n";
import type { Theme } from "../theme";

export type View = "ports" | "history" | "logs";
const VIEWS: { id: View; label: "nav.ports" | "nav.history" | "nav.logs" }[] = [
  { id: "ports", label: "nav.ports" },
  { id: "history", label: "nav.history" },
  { id: "logs", label: "nav.logs" },
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
  const { t, locale, setLocale } = useI18n();
  const autostart = useAutostart();

  return (
    <header className="toolbar">
      <h1 className="wordmark">
        portiye<span className="wordmark__dot">.</span>
      </h1>

      {/* Radio semantics: exactly one view is active, and arrow keys move
          between them the way a tab strip should. */}
      <div className="tabs" role="tablist" aria-label={t("nav.view")}>
        {VIEWS.map((v) => (
          <button
            key={v.id}
            role="tab"
            className="tab"
            aria-selected={view === v.id}
            data-active={view === v.id || undefined}
            onClick={() => onView(v.id)}
          >
            {t(v.label)}
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
              aria-label={t("toolbar.exportFormat")}
            >
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
            </select>
            <button
              className="btn"
              onClick={onExport}
              title={t("toolbar.exportTitle")}
            >
              <DownloadIcon />
              {t("toolbar.export")}
            </button>
          </div>
        </>
      )}

      {/* Language names stay in their own language — a picker you cannot read
          is no picker at all. */}
      <select
        className="select"
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        aria-label={t("toolbar.language")}
        title={t("toolbar.language")}
      >
        {Object.entries(LOCALES).map(([tag, name]) => (
          <option key={tag} value={tag}>
            {name}
          </option>
        ))}
      </select>

      {/* Null while the query is in flight, and permanently null outside a
          Tauri window — a browser has no login items to toggle. */}
      {autostart.supported && (
        <label
          className="toolbar__setting"
          title={t(autostart.enabled ? "toolbar.autostartOn" : "toolbar.autostartOff")}
        >
          <input
            type="checkbox"
            className="pick"
            checked={autostart.enabled}
            onChange={(e) => autostart.set(e.target.checked)}
          />
          {t("toolbar.autostart")}
        </label>
      )}

      <button
        className="btn btn--icon"
        onClick={onRefresh}
        aria-label={t("toolbar.refresh")}
        title={t("toolbar.refreshTitle")}
      >
        <RefreshIcon />
      </button>

      <button
        className="btn btn--icon"
        onClick={() => onTheme(theme === "dark" ? "light" : "dark")}
        aria-label={t(theme === "dark" ? "toolbar.toLight" : "toolbar.toDark")}
        title={t(theme === "dark" ? "toolbar.toLight" : "toolbar.toDark")}
      >
        {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      </button>
    </header>
  );
}

/**
 * The login item, owned by the OS rather than by us.
 *
 * ponytail: no persisted mirror of this flag. The plugin writes a LaunchAgent
 * / registry key / .desktop file, and that file *is* the state — a copy in
 * localStorage would only be a second source of truth to disagree with.
 */
function useAutostart() {
  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    autostartEnabled()
      .then((on) => {
        // The harness stub answers `null`; a null `checked` would flip the box
        // from controlled to uncontrolled mid-render.
        setEnabled(!!on);
        setSupported(true);
      })
      // No Tauri bridge (the Vite preview) or no support on this platform.
      .catch(() => setSupported(false));
  }, []);

  const set = async (on: boolean) => {
    // Optimistic: the checkbox must not lag a filesystem write.
    setEnabled(on);
    try {
      await (on ? enableAutostart() : disableAutostart());
      setEnabled(!!(await autostartEnabled()));
    } catch {
      setEnabled(!on);
    }
  };

  return { enabled, supported, set };
}
