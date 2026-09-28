import { useEffect, useRef } from "react";
export function useDialogFocus(open: boolean, onClose: () => void) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = Array.from(
      document.querySelectorAll<HTMLElement>('[role="dialog"]'),
    ).at(-1);
    if (!dialog) return;
    const focusable = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),summary,[tabindex="0"]',
        ),
      ).filter((e) => e.getClientRects().length > 0);
    const first =
      dialog.querySelector<HTMLElement>('[aria-label^="Close"]') ||
      focusable()[0];
    first?.focus();
    const key = (e: KeyboardEvent) => {
      if (
        e.defaultPrevented ||
        Array.from(document.querySelectorAll('[role="dialog"]')).at(-1) !==
          dialog
      )
        return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close.current();
      }
      if (e.key === "Tab") {
        const items = focusable();
        if (!items.length) {
          e.preventDefault();
          return;
        }
        const index = items.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && index <= 0) {
          e.preventDefault();
          items.at(-1)?.focus();
        } else if (!e.shiftKey && (index === items.length - 1 || index < 0)) {
          e.preventDefault();
          items[0].focus();
        }
      }
    };
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("keydown", key, true);
      if (previous?.isConnected && previous.getClientRects().length)
        previous.focus();
    };
  }, [open]);
}
