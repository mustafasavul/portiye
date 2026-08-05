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
