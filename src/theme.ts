import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const KEY = "portiye:theme";
const query = () => window.matchMedia("(prefers-color-scheme: dark)");

/**
 * Light/dark with a system default. An explicit choice is persisted and wins;
 * until the user makes one, the app follows the OS live.
 */
export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setStored] = useState<Theme>(
    () =>
      (localStorage.getItem(KEY) as Theme | null) ??
      (query().matches ? "dark" : "light"),
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (localStorage.getItem(KEY)) return; // user chose — stop following the OS
    const mq = query();
    const onChange = (e: MediaQueryListEvent) =>
      setStored(e.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  return [
    theme,
    (t: Theme) => {
      localStorage.setItem(KEY, t);
      setStored(t);
    },
  ];
}
