import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const query = () => window.matchMedia("(prefers-color-scheme: dark)");

/**
 * The app always opens on the system appearance and keeps following it live.
 * The toggle is a session override — it wins while the window is open and is
 * deliberately not persisted, so a relaunch is always back to system default.
 */
export function useTheme(): [Theme, (t: Theme) => void] {
  const [override, setOverride] = useState<Theme | null>(null);
  const [system, setSystem] = useState<Theme>(() =>
    query().matches ? "dark" : "light",
  );

  useEffect(() => {
    const mq = query();
    const onChange = (e: MediaQueryListEvent) =>
      setSystem(e.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const theme = override ?? system;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return [theme, setOverride];
}
