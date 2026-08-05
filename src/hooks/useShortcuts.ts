import { useEffect, useRef } from "react";

/** Keyed by `⌘`/`Ctrl` + the lowercase key, or a bare key like "Escape". */
export type Shortcuts = Record<string, () => void>;

/** True when the user is typing, so a bare key must not steal the keystroke. */
function inField(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  const tag = el?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable === true;
}

/**
 * Window-level shortcuts.
 *
 * The handlers are read through a ref so the listener is installed once: a
 * dependency array over freshly-created closures would tear down and rebind on
 * every render, and drop keystrokes in the gap.
 */
export function useShortcuts(shortcuts: Shortcuts) {
  const latest = useRef(shortcuts);
  latest.current = shortcuts;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      // Modifier combinations win everywhere, including inside the filter box;
      // bare keys defer to whatever the user is typing into.
      const key = mod
        ? `mod+${e.key.toLowerCase()}`
        : inField(e.target)
          ? null
          : e.key;

      const run = key && latest.current[key];
      if (!run) return;
      e.preventDefault();
      run();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
