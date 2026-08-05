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
}: {
  title: string;
  devices: Device[];
  busy: string | null;
  run: (id: string, action: () => Promise<void>) => void;
  ask: (a: Ask) => Promise<boolean>;
  empty?: string;
}) {
  const running = devices.filter((d) => d.running).length;

  return (
    <section className="panel">
      <div className="panel__head">
        <h2 className="panel__title">{title}</h2>
        <span className="panel__count">
          {running} / {devices.length} running
        </span>
      </div>
      <div className="panel__body">
        {devices.length === 0 ? (
          <p className="empty">{empty}</p>
        ) : (
          <ul className="devices">
            {devices.map((d) => (
              <DeviceRow
                key={d.id}
                device={d}
                busy={busy === d.id}
                onToggle={() => d.toggle && run(d.id, d.toggle)}
                onRestart={() => d.restart && run(d.id, d.restart)}
                onReset={async () => {
                  if (!d.reset) return;
                  const ok = await ask({
                    title: `Reset ${d.name}?`,
                    warning: d.resetWarning,
                    confirmLabel: d.resetLabel,
                  });
                  if (ok) run(d.id, d.reset);
                }}
              />
            ))}
          </ul>
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
            title={`Stop and start ${device.name} again, keeping its data`}
          >
            Restart
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
