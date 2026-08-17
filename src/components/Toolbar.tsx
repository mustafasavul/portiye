import { useState } from "react";
import { CopyIcon, DownloadIcon, MoonIcon, RefreshIcon, SunIcon } from "../icons";
import { LOCALES, useI18n, useT, type Key, type Locale } from "../i18n";
import type { Theme } from "../theme";

export type View = "ports" | "history" | "logs" | "settings";
const VIEWS: { id: View; label: Key }[] = [
  { id: "ports", label: "nav.ports" },
  { id: "history", label: "nav.history" },
  { id: "logs", label: "nav.logs" },
  { id: "settings", label: "nav.settings" },
];

export function Toolbar({
  view,
  onView,
  theme,
  onTheme,
  onRefresh,
  onExport,
  canStreamLogs,
  lanIp,
}: {
  view: View;
  onView: (v: View) => void;
  theme: Theme;
  onTheme: (t: Theme) => void;
  onRefresh: () => void;
  onExport: () => void;
  /** False on a machine with neither Xcode nor the Android SDK — the tab is
   *  dropped rather than opening onto a picker that can never be filled. */
  canStreamLogs: boolean;
  /** This machine's address on the LAN. Null off any network — then there is
   *  nothing to type into a phone and the chip is dropped rather than zeroed. */
  lanIp: string | null;
}) {
  const { t, locale, setLocale } = useI18n();
  const views = VIEWS.filter((v) => v.id !== "logs" || canStreamLogs);

  return (
    <header className="toolbar">
      <h1 className="wordmark">
        portiye<span className="wordmark__dot">.</span>
      </h1>

      {/* Radio semantics: exactly one view is active, and arrow keys move
          between them the way a tab strip should. */}
      <div className="tabs" role="tablist" aria-label={t("nav.view")}>
        {views.map((v) => (
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

      {/* The other half of the LAN chips in the table: the address is one per
          machine, so it is stated once, up here, instead of on every row. */}
      {lanIp && <LanAddress ip={lanIp} />}

      <div className="toolbar__spacer" />

      {/* Export acts on the port table, so it only exists while it is on
          screen. */}
      {view === "ports" && (
        <button className="btn" onClick={onExport} title={t("toolbar.exportTitle")}>
          <DownloadIcon />
          {t("toolbar.export")}
        </button>
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
        {Object.entries(LOCALES).map(([tag, { name }]) => (
          <option key={tag} value={tag}>
            {name}
          </option>
        ))}
      </select>

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
 * This machine's address, and one click to put it on the clipboard — it exists
 * to be typed into a phone, and typing four numbers off a screen is the part
 * that goes wrong.
 */
function LanAddress({ ip }: { ip: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ip);
    } catch {
      // The async clipboard needs a permission the webview does not always
      // grant; `execCommand` is deprecated and still never blocked.
      const box = document.createElement("textarea");
      box.value = ip;
      box.style.position = "fixed";
      box.style.opacity = "0";
      document.body.append(box);
      box.select();
      document.execCommand("copy");
      box.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <span className="toolbar__ip" title={t("lan.address")}>
      {/* An acronym, not prose — it reads the same in every locale. */}
      <span className="toolbar__ip-label">LAN IP:</span>
      <span className="toolbar__ip-value">{ip}</span>
      <button
        className="btn btn--icon toolbar__copy"
        onClick={copy}
        aria-label={t("lan.copy")}
        title={copied ? t("lan.copied") : t("lan.copy")}
      >
        {copied ? "✓" : <CopyIcon />}
      </button>
    </span>
  );
}
