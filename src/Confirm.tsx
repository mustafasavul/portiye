import { useEffect, useRef, useState } from "react";

/**
 * A confirmation the app draws itself.
 *
 * `window.confirm` is not dependable inside the Tauri webview — on macOS it
 * returns without ever showing a panel, so every destructive action guarded by
 * it silently did nothing. Native `<dialog>` costs no dependency and brings
 * the focus trap, Esc-to-close and backdrop for free.
 */
/** One affected item: what it is, then where it came from. */
export type AskLine = { primary: string; secondary?: string };

export type Ask = {
  title: string;
  /** Exactly what is about to be affected. */
  lines?: AskLine[];
  /** Amber block above the buttons when the target is risky. */
  warning?: string | null;
  /** Quiet line stating what else the action reaches. */
  note?: string;
  confirmLabel: string;
};

type Pending = Ask & { resolve: (ok: boolean) => void };

/** Returns [ask, dialog] — `ask` resolves true only on explicit confirmation. */
export function useConfirm(): [(a: Ask) => Promise<boolean>, React.ReactNode] {
  const [pending, setPending] = useState<Pending | null>(null);
  const ref = useRef<HTMLDialogElement>(null);

  const ask = (a: Ask) =>
    new Promise<boolean>((resolve) => setPending({ ...a, resolve }));

  useEffect(() => {
    if (pending) ref.current?.showModal();
  }, [pending]);

  const settle = (ok: boolean) => {
    pending?.resolve(ok);
    ref.current?.close();
    setPending(null);
  };

  const dialog = pending ? (
    <dialog
      ref={ref}
      className="confirm"
      aria-labelledby="confirm-title"
      // Esc and the backdrop both mean "no".
      onCancel={(e) => {
        e.preventDefault();
        settle(false);
      }}
      onClick={(e) => {
        if (e.target === ref.current) settle(false);
      }}
    >
      <h2 className="confirm__title" id="confirm-title">
        {pending.title}
      </h2>

      {pending.lines && pending.lines.length > 0 && (
        <ul className="confirm__list">
          {pending.lines.map((line) => (
            <li key={line.primary}>
              <span className="confirm__primary">{line.primary}</span>
              {line.secondary && (
                <span className="confirm__secondary">{line.secondary}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {pending.note && <p className="confirm__note">{pending.note}</p>}

      {pending.warning && (
        <p className="confirm__warning">
          <span aria-hidden="true">⚠</span>
          {pending.warning}
        </p>
      )}

      <div className="confirm__actions">
        {/* Cancel is focused first: the destructive button is never one
            stray Return away. */}
        <button className="btn" autoFocus onClick={() => settle(false)}>
          Cancel
        </button>
        <button className="btn btn--solid-danger" onClick={() => settle(true)}>
          {pending.confirmLabel}
        </button>
      </div>
    </dialog>
  ) : null;

  return [ask, dialog];
}
