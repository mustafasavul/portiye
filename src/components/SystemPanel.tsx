import type { ReactNode } from "react";
import { useT } from "../i18n";
import { mb } from "../types";
import type { SystemStats } from "../types";
import { CpuIcon, DiskIcon, GpuIcon, MemoryIcon } from "../icons";
import { SettingsButton } from "./SettingsButton";

/** Above 90% the machine is the problem; above 75% it is about to be. */
const level = (pct: number) =>
  pct >= 90 ? "critical" : pct >= 75 ? "high" : "normal";

/**
 * Host-wide CPU, RAM and disk, between the devices and the ports.
 *
 * These are whole-machine figures on purpose. Emulators and simulators share
 * the host — iOS simulators are not isolated processes at all — so a per-device
 * column would be a number with nothing behind it.
 */
export function SystemPanel({
  stats,
  showCpu,
  showGpu,
  showMemory,
  showDisk,
  onSettings,
}: {
  stats: SystemStats | null;
  /** Set in Settings. GPU off also stops the measurement in Rust, so this
   *  gauge would go `null` a tick later anyway — hiding it now keeps the panel
   *  from flickering one last reading. */
  showCpu: boolean;
  showGpu: boolean;
  showMemory: boolean;
  showDisk: boolean;
  /** Opens the settings view, where these gauges can be switched off. */
  onSettings: () => void;
}) {
  const t = useT();
  if (!stats) return null;

  const memPct = stats.memory_total
    ? (stats.memory_used / stats.memory_total) * 100
    : 0;
  const diskPct = stats.disk_total
    ? (stats.disk_used / stats.disk_total) * 100
    : 0;

  return (
    <section className="panel panel--system">
      <div className="panel__head">
        <h2 className="panel__title">{t("system.title")}</h2>
        <SettingsButton onClick={onSettings} />
      </div>
      <div className="panel__body">
        <ul className="gauges">
          {showCpu && (
            <Gauge
              icon={<CpuIcon />}
              label={t("system.cpu")}
              percent={stats.cpu}
              detail={t("system.load")}
            />
          )}
          {/* Null on a machine with no counter we can read without root —
              an assured 0% would be worse than no row. */}
          {showGpu && stats.gpu !== null && (
            <Gauge
              icon={<GpuIcon />}
              label={t("system.gpu")}
              percent={stats.gpu}
              detail={t("system.load")}
            />
          )}
          {showMemory && (
            <Gauge
              icon={<MemoryIcon />}
              label={t("system.memory")}
              percent={memPct}
              detail={`${mb(stats.memory_used)} / ${mb(stats.memory_total)}`}
            />
          )}
          {/* A machine with no fixed volume reports nothing rather than 0%. */}
          {showDisk && stats.disk_total > 0 && (
            <Gauge
              icon={<DiskIcon />}
              label={t("system.disk")}
              percent={diskPct}
              detail={`${mb(stats.disk_used)} / ${mb(stats.disk_total)}`}
              note={stats.disk_name}
            />
          )}
        </ul>
      </div>
    </section>
  );
}

function Gauge({
  icon,
  label,
  percent,
  detail,
  note,
}: {
  icon: ReactNode;
  label: string;
  percent: number;
  detail: string;
  note?: string;
}) {
  const pct = Math.min(100, Math.max(0, percent));
  return (
    <li className="gauge" data-level={level(pct)}>
      <div className="gauge__head">
        {/* Decorative: the label right beside it already says "CPU". */}
        <span className="gauge__icon">{icon}</span>
        <span className="gauge__label">{label}</span>
        <span className="gauge__value">{Math.round(pct)}%</span>
      </div>
      {/* The bar is decoration over the number; the row itself carries the
          value for assistive tech, so the fill needs no label of its own. */}
      <div
        className="gauge__track"
        role="meter"
        aria-label={label}
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${Math.round(pct)}% — ${detail}`}
      >
        <div className="gauge__fill" style={{ inlineSize: `${pct}%` }} />
      </div>
      <div className="gauge__detail">
        <span>{detail}</span>
        {note && (
          <span className="gauge__note" title={note}>
            {note}
          </span>
        )}
      </div>
    </li>
  );
}
