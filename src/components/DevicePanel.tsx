import { useT } from "../i18n";
import { SettingsButton } from "./SettingsButton";
import type { Ask } from "../Confirm";
import type { Device } from "../types";

/** A titled list of devices — emulators, runtimes, anything row-shaped. */
export function DevicePanel({
  title,
  devices,
  busy,
  run,
  ask,
  empty,
  onSettings,
}: {
  title: string;
  devices: Device[];
  busy: string | null;
  run: (id: string, action: () => Promise<void>) => void;
  ask: (a: Ask) => Promise<boolean>;
  empty?: string;
  /** Opens the settings view, where this panel can be switched off. */
  onSettings: () => void;
}) {
  const t = useT();
  const running = devices.filter((d) => d.running).length;

  // Grouped by platform, because ten devices in one grid is a wall: an iPhone,
  // an iPad and four simulators read as one pile unless Apple's are together
  // and Android's are together. Insertion order, so a machine that only has
  // one platform sees exactly what it saw before — with the subhead dropped,
  // since a single group's heading only repeats the panel title.
  const groups: [string, Device[]][] = [];
  for (const d of devices) {
    const group = groups.find(([platform]) => platform === d.platform);
    if (group) group[1].push(d);
    else groups.push([d.platform, [d]]);
  }
  // Alphabetical, not first-seen: the list is sorted running-first, so a group
  // would otherwise jump position the moment a device boots.
  groups.sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <section className="panel panel--devices">
      <div className="panel__head">
        <h2 className="panel__title">{title}</h2>
        <span className="panel__count">
          {t("devices.count", { running, total: devices.length })}
        </span>
        <SettingsButton onClick={onSettings} />
      </div>
      <div className="panel__body">
        {devices.length === 0 ? (
          <p className="empty">{empty}</p>
        ) : (
          groups.map(([platform, members]) => (
            <div className="devices__group" key={platform}>
              {groups.length > 1 && (
                <h3 className="devices__platform">
                  {platform}
                  <span className="devices__platform-count">
                    {t("devices.count", {
                      running: members.filter((d) => d.running).length,
                      total: members.length,
                    })}
                  </span>
                </h3>
              )}
              <ul className="devices">
                {members.map((d) => (
                  <DeviceRow
                    key={d.id}
                    device={d}
                    busy={busy === d.id}
                    onToggle={() => d.toggle && run(d.id, d.toggle)}
                    onRestart={() => d.restart && run(d.id, d.restart)}
                    onReset={async () => {
                      if (!d.reset) return;
                      const ok = await ask({
                        title: t("device.resetTitle", { name: d.name }),
                        warning: d.resetWarning,
                        confirmLabel: d.resetLabel,
                      });
                      if (ok) run(d.id, d.reset);
                    }}
                  />
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function DeviceRow({
  device,
  busy,
  onToggle,
  onRestart,
  onReset,
}: {
  device: Device;
  busy: boolean;
  onToggle: () => void;
  onRestart: () => void;
  onReset: () => void;
}) {
  const t = useT();
  return (
    <li className={device.running ? "device device--live" : "device"}>
      <span
        className={device.running ? "dot dot--live" : "dot"}
        aria-hidden="true"
      />
      <span className="device__text">
        <span className="device__name" title={device.name}>
          {device.name}
        </span>
        <span className="device__meta">
          {device.platform}
          <span aria-hidden="true">·</span>
          {/* Running state is carried by the dot and the button label, so the
              meta line stays purely identifying. */}
          <span>{device.meta}</span>
        </span>
      </span>
      <span className="device__actions">
        <button
          className={device.running ? "btn" : "btn btn--primary"}
          disabled={busy || !device.toggle}
          aria-busy={busy}
          onClick={onToggle}
        >
          {busy ? "…" : device.toggleLabel}
        </button>
        {/* Restart only means anything once it is up. */}
        {device.restart && device.running && (
          <button
            className="btn"
            disabled={busy}
            aria-busy={busy}
            onClick={onRestart}
            title={t("device.restartTitle", { name: device.name })}
          >
            {t("device.restart")}
          </button>
        )}
        {device.reset && (
          <button
            className="btn btn--danger"
            disabled={busy}
            aria-busy={busy}
            onClick={onReset}
          >
            {device.resetLabel}
          </button>
        )}
      </span>
    </li>
  );
}
