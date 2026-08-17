/**
 * One icon set, hand-drawn on a 16px grid at 1.5px stroke — no icon library,
 * no emoji. All are decorative; the button carries the accessible name.
 */

const base = {
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const RefreshIcon = () => (
  <svg {...base}>
    <path d="M13.5 8a5.5 5.5 0 1 1-1.7-3.97" />
    <path d="M13.4 2.4v2.9h-2.9" />
  </svg>
);

export const SunIcon = () => (
  <svg {...base}>
    <circle cx="8" cy="8" r="3" />
    <path d="M8 1v1.6M8 13.4V15M15 8h-1.6M2.6 8H1M12.9 3.1l-1.1 1.1M4.2 11.8l-1.1 1.1M12.9 12.9l-1.1-1.1M4.2 4.2 3.1 3.1" />
  </svg>
);

export const MoonIcon = () => (
  <svg {...base}>
    <path d="M13.5 9.6A5.8 5.8 0 0 1 6.4 2.5a5.8 5.8 0 1 0 7.1 7.1Z" />
  </svg>
);

/** Points up for ascending; CSS flips it for descending. */
export const SortArrowIcon = () => (
  <svg {...base}>
    <path d="M8 12.5V3.5M4.5 7 8 3.5 11.5 7" />
  </svg>
);

export const DownloadIcon = () => (
  <svg {...base}>
    <path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M2.5 13.5h11" />
  </svg>
);

export const CloseIcon = () => (
  <svg {...base}>
    <path d="m4 4 8 8M12 4l-8 8" />
  </svg>
);

export const CopyIcon = () => (
  <svg {...base}>
    <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
    <path d="M10.5 3.5v-.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h.5" />
  </svg>
);

/**
 * Settings. A closed toothed outline, not spokes around a circle — spokes read
 * as a sun at 15px, which is the icon two buttons away in the toolbar.
 */
export const GearIcon = () => (
  <svg {...base}>
    <path d="M6.75 1.9h2.5l.25 1.65 1.2.7 1.5-.7 1.25 2.15-1.2 1.15v1.4l1.2 1.15-1.25 2.15-1.5-.7-1.2.7-.25 1.65h-2.5L6.5 12.4l-1.2-.7-1.5.7L2.55 10.25l1.2-1.15v-1.4L2.55 6.55 3.8 4.4l1.5.7 1.2-.7z" />
    <circle cx="8" cy="8" r="2.1" />
  </svg>
);

/* ——— System gauges ————————————————————————————————————
 * Four silhouettes that stay apart at 14px: a square with legs, a square with
 * a core, stacked bars, stacked platters.
 */

/** A packaged die with pins on all four sides. */
export const CpuIcon = () => (
  <svg {...base}>
    <rect x="4.5" y="4.5" width="7" height="7" rx="1" />
    <path d="M6.5 1.5V4M9.5 1.5V4M6.5 12v2.5M9.5 12v2.5M1.5 6.5H4M1.5 9.5H4M12 6.5h2.5M12 9.5h2.5" />
  </svg>
);

/** The same package, cored out — the die reads as the render target. */
export const GpuIcon = () => (
  <svg {...base}>
    <rect x="2.5" y="4" width="11" height="8" rx="1.5" />
    <rect x="5.5" y="6.75" width="5" height="2.5" rx="0.5" />
    <path d="M5 12v2.5M11 12v2.5" />
  </svg>
);

/** A DIMM: the module, its chips, and the notched contact edge. */
export const MemoryIcon = () => (
  <svg {...base}>
    <rect x="1.5" y="4.5" width="13" height="6" rx="1" />
    <path d="M4.5 6.5v2M8 6.5v2M11.5 6.5v2M4 10.5v2M12 10.5v2" />
  </svg>
);

/** Stacked platters — the one shape that never reads as a CPU. */
export const DiskIcon = () => (
  <svg {...base}>
    <ellipse cx="8" cy="4" rx="5.5" ry="2.5" />
    <path d="M2.5 4v8c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V4" />
    <path d="M2.5 8c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5" />
  </svg>
);
