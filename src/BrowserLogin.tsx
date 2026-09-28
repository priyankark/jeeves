import { useEffect, useRef, useState } from "react";
import { Loader2, Monitor } from "lucide-react";
import type { BrowserLogin as Login } from "../shared/browser-login";
import { api } from "./api";
import { WebsiteAccess } from "./WebsiteAccess";
import { useAttention } from "./Attention";
import { FriendlyError } from "./FriendlyError";

export function BrowserLogin({
  workflowId,
  nodeId,
  label,
  input,
  disabled,
  beforeStart,
  onBusy,
}: {
  workflowId: string;
  nodeId: string;
  label: string;
  input?: string;
  disabled?: boolean;
  beforeStart?: () => Promise<unknown>;
  onBusy?: (busy: boolean) => void;
}) {
  const { publishLogin } = useAttention();
  const [session, setSession] = useState<Login | null>(null);
  useEffect(() => {
    if (session) publishLogin(session);
  }, [session, publishLogin]);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const busyRef = useRef(onBusy);
  busyRef.current = onBusy;
  const busy =
    pending || (!!session && ["working", "waiting"].includes(session.status));
  useEffect(() => {
    busyRef.current?.(busy);
    return () => busyRef.current?.(false);
  }, [busy]);
  useEffect(() => {
    let alive = true;
    setSession(null);
    setError("");
    void api<Login[]>("/browser/logins")
      .then((items) => {
        if (alive)
          setSession(
            items.find(
              (s) => s.workflowId === workflowId && s.nodeId === nodeId,
            ) || null,
          );
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [workflowId, nodeId]);
  useEffect(() => {
    if (!session || !["working", "waiting"].includes(session.status)) return;
    let alive = true;
    const timer = setInterval(() => {
      void api<Login>(`/browser/logins/${session.id}`)
        .then((next) => {
          if (alive) setSession(next);
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    }, 700);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [session?.id, session?.status]);
  async function act(action: "start" | "finish" | "cancel") {
    setPending(true);
    setError("");
    try {
      if (action === "start") {
        const parsed = input ? JSON.parse(input) : undefined;
        await beforeStart?.();
        setSession(
          await api<Login>("/browser/logins", {
            method: "POST",
            body: JSON.stringify({ workflowId, nodeId, input: parsed }),
          }),
        );
      } else if (session)
        setSession(
          await api<Login>(`/browser/logins/${session.id}/${action}`, {
            method: "POST",
          }),
        );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  return (
    <section
      className="browser-login"
      aria-label={`Browser sign-in · ${label}`}
    >
      <strong>Website sign-in</strong>
      <p>
        Use CUA to find sign-in in a visible Chrome window. You enter passwords,
        MFA and CAPTCHA yourself; the session stays on this device for this
        workflow step.
      </p>
      <p>
        Uses this step’s live agent provider, including when the workflow is in
        demo mode.
      </p>
      {!busy && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => void act("start")}
        >
          <Monitor size={15} /> Use CUA to sign in
        </button>
      )}
      {session?.status === "working" && (
        <p role="status">
          <Loader2 size={14} className="spin" /> {session.message}
        </p>
      )}
      {session?.status === "waiting" && (
        <div className="login-handoff">
          <strong>Your turn — sign in to continue</strong>
          <p role="status">{session.message}</p>
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              void api(`/browser/logins/${session.id}/focus`, {
                method: "POST",
              }).catch((e) => setError(e.message))
            }
          >
            <Monitor size={15} /> Bring browser forward
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void act("finish")}
          >
            I’m signed in
          </button>
        </div>
      )}
      {busy && (
        <button
          type="button"
          disabled={pending}
          onClick={() => void act("cancel")}
        >
          Cancel sign-in assistance
        </button>
      )}
      {session && !["working", "waiting"].includes(session.status) && (
        <div role={session.status === "failed" ? "alert" : "status"}>
          {session.status === "failed" ? (
            <FriendlyError message={session.message} />
          ) : (
            session.message
          )}
        </div>
      )}
      {error && (
        <div className="error-text" role="alert">
          <FriendlyError message={error} />
          <WebsiteAccess
            message={error}
            onRetry={() => act("start")}
            retryLabel="Retry sign-in assistance"
          />
        </div>
      )}
      {session?.status === "failed" && (
        <WebsiteAccess
          key={session.id}
          message={session.message}
          onRetry={() => act("start")}
          retryLabel="Retry sign-in assistance"
        />
      )}
    </section>
  );
}
