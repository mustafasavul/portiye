import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import {
  disable as disableAutostart,
  enable as enableAutostart,
  isEnabled as autostartEnabled,
} from "@tauri-apps/plugin-autostart";
import { useT } from "../i18n";
import { THRESHOLDS, thresholdLabel } from "../types";
import type { Key } from "../i18n";
import type { Panels, TrayOptions } from "../types";

/**
 * Everything that is set once and then left alone. The controls that act on
 * what is currently on screen — the filter, the nesting toggle, Export itself —
 * stay with the table; only the knobs live here.
 */
export function Settings({
  panels,
  onPanels,
  tray,
  onTray,
  memoryWarnMb,
  onMemoryWarnMb,
  format,
  onFormat,
}: {
  /** Which panels and columns the window draws. GPU is not only a column:
   *  off, the Rust side stops measuring it. */
  panels: Panels;
  onPanels: (next: Panels) => void;
  tray: TrayOptions;
  onTray: (next: TrayOptions) => void;
  memoryWarnMb: number;
  onMemoryWarnMb: (v: number) => void;
  format: "json" | "csv";
  onFormat: (f: "json" | "csv") => void;
}) {
  const t = useT();
  const autostart = useAutostart();
  const version = useVersion();
  const panel = (k: keyof Panels) => (v: boolean) =>
    onPanels({ ...panels, [k]: v });
  const trayOption = (k: keyof TrayOptions) => (v: boolean) =>
    onTray({ ...tray, [k]: v });

  return (
    <div className="settings">
      <Section title="settings.panels">
        <Switch
          label={t("devices.title")}
          hint={t("settings.devicesHint")}
          checked={panels.devices}
          onChange={panel("devices")}
        />
        {/* The one switch that clears all four gauges at once — the individual
            ones below stay where they are. */}
        <Switch
          label={t("system.title")}
          hint={t("settings.systemHint")}
          checked={panels.system}
          onChange={panel("system")}
        />
      </Section>

      <Section title="settings.columns">
        <Switch
          label={t("system.cpu")}
          hint={t("settings.cpuHint")}
          checked={panels.cpu}
          onChange={panel("cpu")}
        />
        {/* The only switch that turns work off rather than a column: off,
            neither the host probe nor the NVIDIA sampler runs. */}
        <Switch
          label={t("system.gpu")}
          hint={t("settings.gpuHint")}
          checked={panels.gpu}
          onChange={panel("gpu")}
        />
        <Switch
          label={t("system.memory")}
          hint={t("settings.memoryHint")}
          checked={panels.memory}
          onChange={panel("memory")}
        />
        <Switch
          label={t("system.disk")}
          hint={t("settings.diskHint")}
          checked={panels.disk}
          onChange={panel("disk")}
        />
      </Section>

      <Section title="settings.tray">
        <Switch
          label={t("settings.trayVisible")}
          hint={t("settings.trayVisibleHint")}
          checked={tray.visible}
          onChange={trayOption("visible")}
        />
        {/* Nothing below matters while the icon is gone, and a live switch
            that changes nothing you can see is worse than a dim one. */}
        <Switch
          label={t("settings.trayStats")}
          hint={t("settings.trayStatsHint")}
          checked={tray.stats}
          disabled={!tray.visible}
          onChange={trayOption("stats")}
        />
        <Switch
          label={t("ports.title")}
          hint={t("settings.trayPortsHint")}
          checked={tray.ports}
          disabled={!tray.visible}
          onChange={trayOption("ports")}
        />
        <Switch
          label={t("devices.title")}
          hint={t("settings.trayDevicesHint")}
          checked={tray.devices}
          disabled={!tray.visible}
          onChange={trayOption("devices")}
        />
      </Section>

      <Section title="settings.ports">
        <Field label={t("ports.flagOver")} hint={t("settings.flagHint")}>
          <select
            className="select"
            value={memoryWarnMb}
            onChange={(e) => onMemoryWarnMb(Number(e.target.value))}
            aria-label={t("ports.flagAria")}
          >
            {THRESHOLDS.map((n) => (
              <option key={n} value={n}>
                {thresholdLabel(n)}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="settings.export">
        <Field
          label={t("toolbar.exportFormat")}
          hint={t("settings.formatHint")}
        >
          <select
            className="select"
            value={format}
            onChange={(e) => onFormat(e.target.value as "json" | "csv")}
            aria-label={t("toolbar.exportFormat")}
          >
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
          </select>
        </Field>
      </Section>

      {/* Null while the query is in flight, and permanently null outside a
          Tauri window — a browser has no login items to toggle. */}
      {autostart.supported && (
        <Section title="settings.startup">
          <Switch
            label={t("toolbar.autostart")}
            hint={t(
              autostart.enabled ? "toolbar.autostartOn" : "toolbar.autostartOff",
            )}
            checked={autostart.enabled}
            onChange={autostart.set}
          />
          {/* Writing the login item can fail — a sandbox, a locked LaunchAgents
              directory. It used to fail silently, which read as a switch that
              would not stay on. */}
          {autostart.error && (
            <li className="setting">
              <p className="setting__error" role="alert">
                {t("settings.startupFailed", { error: autostart.error })}
              </p>
            </li>
          )}
        </Section>
      )}

      <Section title="settings.about">
        <li className="setting">
          <p className="setting__hint">
            portiye <span className="setting__version">{version ?? "—"}</span>
          </p>
        </li>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: Key;
  children: React.ReactNode;
}) {
  const t = useT();
  return (
    <section className="panel">
      <div className="panel__head">
        <h2 className="panel__title">{t(title)}</h2>
      </div>
      <div className="panel__body">
        <ul className="settings__list">{children}</ul>
      </div>
    </section>
  );
}

/** A row whose whole label is the hit target — the box alone is 13px wide. */
function Switch({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <li className="setting" data-disabled={disabled || undefined}>
      <label className="setting__label">
        <input
          type="checkbox"
          className="pick"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        {label}
      </label>
      <p className="setting__hint">{hint}</p>
    </li>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <li className="setting">
      <label className="setting__label">
        {label}
        {children}
      </label>
      <p className="setting__hint">{hint}</p>
    </li>
  );
}

/** The version the bundle was built with — read from Tauri, not from a copy. */
function useVersion() {
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    getVersion()
      .then(setVersion)
      .catch(() => setVersion(null));
  }, []);
  return version;
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
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    try {
      await (on ? enableAutostart() : disableAutostart());
      // Read it back rather than trusting the write: the plugin reports
      // success for a plist the OS may still refuse to honour.
      setEnabled(!!(await autostartEnabled()));
    } catch (e) {
      setEnabled(!on);
      setError(String(e));
    }
  };

  return { enabled, supported, error, set };
}
