import { useCallback, useState } from "react";

/**
 * State that survives a relaunch.
 *
 * ponytail: webview `localStorage`, not a JSON file under the app config dir.
 * It persists in Tauri exactly the same way and costs no Rust, no serde and no
 * error paths. Move to a real file if these ever need to be hand-edited,
 * synced between machines, or read by anything outside the app.
 */
export function usePersisted<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(`portiye:${key}`);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      // A corrupt or hand-mangled entry must not take the app down with it.
      return initial;
    }
  });

  const set = useCallback(
    (next: T | ((prev: T) => T)) =>
      setValue((prev) => {
        const resolved =
          typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        try {
          localStorage.setItem(`portiye:${key}`, JSON.stringify(resolved));
        } catch {
          // Out of quota or private mode: keep the value in memory anyway.
        }
        return resolved;
      }),
    [key],
  );

  return [value, set] as const;
}
