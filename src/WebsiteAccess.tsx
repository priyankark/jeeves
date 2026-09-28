import { useState } from "react";
import { api } from "./api";

export function WebsiteAccess({
  message,
  onGranted,
  onRetry,
  retryLabel = "Retry from checkpoint",
}: {
  message: string;
  onGranted?: () => void | Promise<void>;
  onRetry?: () => void | Promise<void>;
  retryLabel?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [allowed, setAllowed] = useState<string | null>(null);
  const [error, setError] = useState("");
  const match = message.match(
    /(?:Allow(?: action origin)?|Navigation to) (https?:\/\/[^\s]+)(?: in Settings| needs permission|$)/,
  );
  let origin = "";
  try {
    if (match) {
      const url = new URL(match[1]);
      if (!url.username && !url.password) origin = url.origin;
    }
  } catch {}
  if (!origin) return null;
  async function grant(all: boolean) {
    setBusy(true);
    setError("");
    try {
      await api("/integrations", {
        method: "PUT",
        body: JSON.stringify(
          all ? { allowAllWebsites: true } : { addOrigin: origin },
        ),
      });
      await onGranted?.();
      setAllowed(origin);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function retry() {
    setBusy(true);
    setError("");
    try {
      await onRetry?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="website-access">
      {allowed === origin ? (
        <div>
          <p role="status">Website access saved. Retry the run when ready.</p>
          {onRetry && (
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={() => void retry()}
            >
              {busy ? "Retrying…" : retryLabel}
            </button>
          )}
        </div>
      ) : (
        <>
          <div>
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={() => void grant(false)}
            >
              Allow {origin}
            </button>
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => void grant(true)}
            >
              Allow all websites & APIs
            </button>
          </div>
          <p className="field-note">
            Allow all applies to every workflow on this device. Change it any
            time in Settings. Credentials remain scoped to their websites.
          </p>
        </>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
    </div>
  );
}
