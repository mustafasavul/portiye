import { useState } from "react";
import type { Device } from "../types";

/** A named set of devices to bring up together for a test run. */
export type Profile = { name: string; deviceIds: string[] };

export function Profiles({
  profiles,
  devices,
  busy,
  onLaunch,
  onRemove,
  onSave,
}: {
  profiles: Profile[];
  devices: Device[];
  busy: string | null;
  onLaunch: (p: Profile, targets: Device[]) => void;
  onRemove: (name: string) => void;
  onSave: (p: Profile) => void;
}) {
  // Creation lives here rather than in a dialog: `prompt` is as unusable as
  // `confirm` inside the Tauri webview, and an inline form needs no plumbing.
  const [draft, setDraft] = useState<Profile | null>(null);

  return (
    <section className="panel">
      <div className="panel__head">
        <h2 className="panel__title">Profiles</h2>
        <button
          className="btn"
          disabled={devices.length === 0 || draft !== null}
          onClick={() => setDraft({ name: "", deviceIds: [] })}
        >
          New profile
        </button>
        <span className="panel__count">{profiles.length}</span>
      </div>

      <div className="panel__body">
        {draft && (
          <form
            className="draft"
            onSubmit={(e) => {
              e.preventDefault();
              const name = draft.name.trim();
              if (!name || draft.deviceIds.length === 0) return;
              onSave({ ...draft, name });
              setDraft(null);
            }}
          >
            <input
              className="field__input"
              autoFocus
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Profile name, e.g. iOS set"
              aria-label="Profile name"
            />
            <select
              className="select draft__list"
              multiple
              size={Math.min(6, Math.max(2, devices.length))}
              value={draft.deviceIds}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  deviceIds: [...e.target.selectedOptions].map((o) => o.value),
                })
              }
              aria-label="Devices in this profile"
            >
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.platform} · {d.name}
                </option>
              ))}
            </select>
            <span className="draft__actions">
              <button className="btn" type="button" onClick={() => setDraft(null)}>
                Cancel
              </button>
              <button
                className="btn btn--primary"
                type="submit"
                disabled={!draft.name.trim() || draft.deviceIds.length === 0}
              >
                Save
              </button>
            </span>
          </form>
        )}

        {profiles.length === 0 && !draft ? (
          <p className="empty">
            Group the devices a test run needs — “iOS set”, “Android set” — and
            start them together.
          </p>
        ) : (
          <ul className="sweeps">
            {profiles.map((p) => {
              // A profile can outlive a device deleted from Xcode or Android
              // Studio; those ids simply drop out rather than erroring.
              const present = p.deviceIds
                .map((id) => devices.find((d) => d.id === id))
                .filter((d): d is Device => Boolean(d));
              const idle = present.filter((d) => !d.running);
              const missing = p.deviceIds.length - present.length;
              const id = `profile:${p.name}`;

              return (
                <li className="sweep" key={p.name}>
                  <span className="sweep__text">
                    <span className="sweep__name">{p.name}</span>
                    <span className="sweep__rule">
                      {present.map((d) => d.name).join(" · ") || "no devices"}
                      {missing > 0 && ` · ${missing} missing`}
                    </span>
                  </span>
                  <button
                    className="btn btn--primary"
                    disabled={idle.length === 0 || busy === id}
                    aria-busy={busy === id}
                    onClick={() => onLaunch(p, idle)}
                    title={
                      idle.length === 0
                        ? "Everything in this profile is already running"
                        : `Start ${idle.map((d) => d.name).join(", ")}`
                    }
                  >
                    Launch {idle.length}
                  </button>
                  <button
                    className="btn btn--icon"
                    onClick={() => onRemove(p.name)}
                    aria-label={`Delete the ${p.name} profile`}
                    title="Delete this profile"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
