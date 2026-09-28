import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Bell, Check, CheckCircle2, Monitor, Volume2, X } from "lucide-react";
import { createPortal } from "react-dom";
import type { BrowserLogin } from "../shared/browser-login";
import type { Run, Workflow } from "../shared/schema";
import { api, ApiError } from "./api";
import { useDialogFocus } from "./useDialogFocus";

type Notice = {
  id: string;
  title: string;
  body: string;
  workflowId: string;
  nodeId?: string;
  runId?: string;
  inputRequest?: boolean;
  urgent: boolean;
  read: boolean;
};
type Preferences = { sound: boolean; desktop: boolean };
type DesktopBridge = {
  notify: (notice: {
    id: string;
    title: string;
    body: string;
  }) => Promise<boolean>;
  onNotificationClick: (callback: (id: string) => void) => () => void;
};
declare global {
  interface Window {
    jeevesDesktop?: DesktopBridge;
  }
}
function stored<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
let audio: AudioContext | undefined;
async function chime() {
  try {
    audio ||= new AudioContext();
    await audio.resume();
    for (const [offset, frequency] of [
      [0, 660],
      [0.14, 880],
    ]) {
      const oscillator = audio.createOscillator(),
        gain = audio.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      const start = audio.currentTime + offset;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.065, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.24);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.25);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    }
  } catch {
    /* Visual alerts remain available if audio is unavailable. */
  }
}
const AttentionContext = createContext<{
  sessions: BrowserLogin[];
  notices: Notice[];
  publishLogin: (session: BrowserLogin) => void;
  publishRun: (run: Run) => void;
  markRead: (id: string) => void;
  preferences: Preferences;
  setPreferences: (next: Preferences) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
} | null>(null);
export const useAttention = () => useContext(AttentionContext)!;

export function AttentionProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<BrowserLogin[]>([]);
  const loginStates = useRef(new Map<string, BrowserLogin>());
  const announcedInputs = useRef(new Set<string>());
  const runStates = useRef(new Map<string, Run["status"]>());
  const [notices, setNotices] = useState<Notice[]>([]);
  const [preferences, setPreferences] = useState<Preferences>(() =>
    stored("jeeves-notifications", { sound: false, desktop: false }),
  );
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;
  const [open, setOpen] = useState(false);
  const announced = useRef(new Set<string>());
  useEffect(() => {
    try {
      localStorage.setItem("jeeves-notifications", JSON.stringify(preferences));
    } catch {}
    if (!preferences.sound) return;
    const unlock = () => {
      try {
        audio ||= new AudioContext();
        void audio.resume().catch(() => {});
      } catch {}
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, [preferences]);
  const announce = useCallback((notice: Notice) => {
    setNotices((items) =>
      [notice, ...items.filter((n) => n.id !== notice.id)].slice(0, 30),
    );
    let already = announced.current.has(notice.id);
    try {
      already ||=
        sessionStorage.getItem(`jeeves-alert:${notice.id}`) === "seen";
      sessionStorage.setItem(`jeeves-alert:${notice.id}`, "seen");
    } catch {}
    if (already) return;
    announced.current.add(notice.id);
    if (preferencesRef.current.sound) void chime();
    if (preferencesRef.current.desktop && !document.hasFocus()) {
      const payload = {
        id: notice.id,
        title: notice.title,
        body: notice.urgent
          ? "Open Jeeves to review the next step."
          : "Your workflow has an update. Open Jeeves to review it.",
      };
      if (window.jeevesDesktop)
        void window.jeevesDesktop.notify(payload).catch(() => {});
      else if (
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        const notification = new Notification(payload.title, {
          body: payload.body,
          tag: payload.id,
          silent: true,
        });
        notification.onclick = () => {
          window.focus();
          setOpen(true);
          notification.close();
        };
      }
    }
  }, []);
  useEffect(
    () => window.jeevesDesktop?.onNotificationClick(() => setOpen(true)),
    [],
  );
  const publishLogin = useCallback(
    (session: BrowserLogin) => {
      const previous = loginStates.current.get(session.id);
      // An older poll must not resurrect a handoff the user already completed.
      if (
        previous &&
        ["completed", "cancelled", "failed"].includes(previous.status) &&
        ["working", "waiting"].includes(session.status)
      )
        return;
      loginStates.current.set(session.id, session);
      if (
        previous?.status === session.status &&
        previous.message === session.message
      )
        return;
      if (["working", "waiting"].includes(session.status)) {
        setNotices((items) =>
          items.map((n) =>
            n.nodeId === session.nodeId &&
            n.workflowId === session.workflowId &&
            n.id !== `login:${session.id}`
              ? { ...n, urgent: false, read: true }
              : n,
          ),
        );
      }
      setSessions(
        [...loginStates.current.values()].filter((s) =>
          ["working", "waiting", "failed"].includes(s.status),
        ),
      );
      if (session.status === "waiting" && previous?.status !== "waiting") {
        announce({
          id: `login:${session.id}`,
          title: "Your browser needs you",
          body: "Complete sign-in in the browser, then return to Jeeves. The agent has paused and stopped observing.",
          workflowId: session.workflowId,
          nodeId: session.nodeId,
          urgent: true,
          read: false,
        });
      } else if (session.status === "failed" && previous?.status !== "failed") {
        announce({
          id: `login:${session.id}`,
          title: "Sign-in needs attention",
          body: "Sign-in assistance stopped. Review the step to recover or try again.",
          workflowId: session.workflowId,
          nodeId: session.nodeId,
          urgent: true,
          read: false,
        });
      } else if (["completed", "cancelled"].includes(session.status)) {
        setNotices((items) =>
          items.map((n) =>
            n.id === `login:${session.id}`
              ? {
                  ...n,
                  urgent: false,
                  read: true,
                  title:
                    session.status === "completed"
                      ? "Browser session saved"
                      : "Sign-in cancelled",
                  body:
                    session.status === "completed"
                      ? "You can continue your workflow."
                      : "Your existing browser session was kept.",
                }
              : n,
          ),
        );
      }
    },
    [announce],
  );
  useEffect(() => {
    let alive = true,
      timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const active = await api<BrowserLogin[]>("/browser/logins");
        if (!alive) return;
        active.forEach(publishLogin);
        const missing = [...loginStates.current.values()].filter(
          (s) =>
            ["working", "waiting"].includes(s.status) &&
            !active.some((a) => a.id === s.id),
        );
        await Promise.all(
          missing.map(async (s) => {
            try {
              const next = await api<BrowserLogin>(`/browser/logins/${s.id}`);
              if (alive) publishLogin(next);
            } catch (e) {
              if (
                alive &&
                e instanceof ApiError &&
                /Sign-in session not found/.test(e.message)
              )
                publishLogin({
                  ...s,
                  status: "cancelled",
                  message: "Sign-in session ended.",
                });
            }
          }),
        );
      } catch {
        /* Keep existing attention items through a temporary disconnect. */
      }
      if (alive) timer = setTimeout(poll, 1500);
    };
    void poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [publishLogin]);
  const publishRun = useCallback(
    (run: Run) => {
      const previous = runStates.current.get(run.id);
      runStates.current.set(run.id, run.status);
      if (run.resumedFrom) {
        setNotices((items) =>
          items.map((notice) =>
            notice.runId === run.resumedFrom
              ? {
                  ...notice,
                  urgent: false,
                  read: true,
                  title: "Run retried from saved progress",
                }
              : notice,
          ),
        );
      }

      if (run.status === "waiting") {
        for (const [nodeId, state] of Object.entries(run.nodes)) {
          if (state.status !== "waiting" || !state.requestId) continue;
          const id = `input:${state.requestId}`;
          if (announcedInputs.current.has(id)) continue;
          announcedInputs.current.add(id);
          announce({
            id,
            title: "Your input is needed",
            body:
              run.workflow.nodes.find((n) => n.id === nodeId)?.data.prompt ||
              "Answer the questions to continue this run.",
            workflowId: run.workflowId,
            runId: run.id,
            nodeId,
            inputRequest: true,
            urgent: true,
            read: false,
          });
        }
        const waitingIds = new Set(
          Object.values(run.nodes)
            .filter((n) => n.status === "waiting")
            .map((n) => `input:${n.requestId}`),
        );
        setNotices((items) =>
          items.map((n) =>
            n.inputRequest && n.runId === run.id && !waitingIds.has(n.id)
              ? { ...n, urgent: false, read: true }
              : n,
          ),
        );
        return;
      }
      setNotices((items) =>
        items.map((n) =>
          n.inputRequest && n.runId === run.id
            ? { ...n, urgent: false, read: true, title: "Answers received" }
            : n,
        ),
      );
      if (
        !["running", "waiting"].includes(previous || "") ||
        run.status === "running"
      )
        return;
      const review = Object.values(run.nodes).some(
        (n) =>
          n.output &&
          typeof n.output === "object" &&
          "needsReview" in n.output &&
          n.output.needsReview === true,
      );
      announce({
        id: `run:${run.id}`,
        title:
          run.status === "failed"
            ? "A workflow needs attention"
            : review
              ? "Your result needs review"
              : run.status === "cancelled"
                ? "Workflow stopped"
                : "Your result is ready",
        body: run.workflowName,
        workflowId: run.workflowId,
        runId: run.id,
        urgent: run.status === "failed" || review,
        read: false,
      });
    },
    [announce],
  );
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const known = new Set<string>();
    async function poll() {
      try {
        const requests = await api<Run[]>("/input-requests");
        if (!alive) return;
        for (const run of requests) {
          known.add(run.id);
          publishRun(run);
        }
        for (const id of known) {
          if (requests.some((r) => r.id === id)) continue;
          const run = await api<Run>(`/runs/${id}`);
          if (!alive) return;
          publishRun(run);
          if (!["running", "waiting"].includes(run.status)) known.delete(id);
        }
      } catch {
        /* Keep requests available through a temporary disconnect. */
      }
      if (alive) timer = setTimeout(poll, 1500);
    }
    void poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [publishRun]);
  return (
    <AttentionContext.Provider
      value={{
        sessions,
        notices,
        publishLogin,
        publishRun,
        preferences,
        setPreferences,
        open,
        setOpen,
        markRead: (id) =>
          setNotices((items) =>
            items.map((n) => (n.id === id ? { ...n, read: true } : n)),
          ),
      }}
    >
      {children}
    </AttentionContext.Provider>
  );
}

export function NotificationSettings() {
  const { preferences, setPreferences } = useAttention();
  const [message, setMessage] = useState("");
  async function desktop(enabled: boolean) {
    if (!enabled) {
      setPreferences({ ...preferences, desktop: false });
      return;
    }
    if (window.jeevesDesktop) {
      setPreferences({ ...preferences, desktop: true });
      setMessage(
        "Desktop alerts enabled. macOS notification settings also apply.",
      );
      return;
    }
    if (!("Notification" in window)) {
      setMessage(
        "Desktop alerts are unavailable here. In-app alerts will still appear.",
      );
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setPreferences({ ...preferences, desktop: permission === "granted" });
      setMessage(
        permission === "granted"
          ? "Desktop alerts enabled."
          : "Desktop alerts were not allowed. You can change this in your browser's site settings; in-app alerts remain available.",
      );
    } catch {
      setMessage(
        "Desktop alerts are unavailable. In-app alerts remain available.",
      );
    }
  }
  return (
    <section
      className="notification-settings"
      aria-label="Notification preferences"
    >
      <div className="settings-section-title">
        <Bell size={20} />
        <div>
          <h3>Let Jeeves get your attention</h3>
          <p>
            Input requests and login handoffs stay in Activity until handled.
            You can keep working elsewhere.
          </p>
        </div>
      </div>
      <label className="preference-toggle">
        <input
          type="checkbox"
          checked={preferences.sound}
          onChange={(e) => {
            setPreferences({ ...preferences, sound: e.target.checked });
            if (e.target.checked) void chime();
          }}
        />
        <span>
          <strong>Play a gentle sound</strong>
          <small>
            One chime for each new input request, login, finished run, or task
            needing review.
          </small>
        </span>
      </label>
      <label className="preference-toggle">
        <input
          type="checkbox"
          checked={preferences.desktop}
          onChange={(e) => void desktop(e.target.checked)}
        />
        <span>
          <strong>Desktop notifications</strong>
          <small>
            Notify me when Jeeves is in the background. Alerts contain no task
            content.
          </small>
        </span>
      </label>
      <button className="subtle-button" onClick={() => void chime()}>
        <Volume2 size={15} />
        Preview sound
      </button>
      {message && <p role="status">{message}</p>}
    </section>
  );
}

export function AttentionCenter({
  workflows,
  onReview,
  onSettings,
}: {
  workflows: Workflow[];
  onReview: (notice: Notice) => Promise<void>;
  onSettings: () => void;
}) {
  const { notices, sessions, markRead, open, setOpen } = useAttention();
  const [error, setError] = useState("");
  const [opening, setOpening] = useState(false);
  const unread = notices.filter((n) => !n.read).length;
  const urgent = notices.find((n) => n.urgent && (n.nodeId || !n.read));
  useDialogFocus(open, () => setOpen(false));
  async function review(notice: Notice) {
    setOpening(true);
    setError("");
    try {
      await onReview(notice);
      markRead(notice.id);
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOpening(false);
    }
  }
  return (
    <>
      {urgent && (
        <button className="attention-prompt" onClick={() => setOpen(true)}>
          <span className="attention-dot" />
          {urgent.title}
        </button>
      )}
      <button
        className={`activity-button ${unread ? "has-activity" : ""}`}
        aria-label={`Activity${unread ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Bell size={17} />
        <span>Activity</span>
        {unread > 0 && <b>{unread}</b>}
      </button>
      <span className="sr-only" aria-live="polite">
        {urgent ? `${urgent.title}. Open Activity to continue.` : ""}
      </span>
      {open &&
        createPortal(
          <div
            className="modal-backdrop activity-backdrop"
            onClick={() => setOpen(false)}
          >
            <section
              className="activity-dialog"
              role="dialog"
              aria-modal="true"
              aria-label="Activity"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="activity-heading">
                <div>
                  <span className="eyebrow">WE’LL KEEP YOUR PLACE</span>
                  <h2>Activity</h2>
                </div>
                <button
                  className="icon-button"
                  aria-label="Close activity"
                  onClick={() => setOpen(false)}
                >
                  <X size={19} />
                </button>
              </div>
              {notices.length === 0 && (
                <div className="activity-empty">
                  <CheckCircle2 size={30} />
                  <h3>You’re all caught up.</h3>
                  <p>
                    Input requests, sign-in requests and workflow results appear
                    here, even when their panel is closed.
                  </p>
                </div>
              )}
              <div className="activity-items">
                {notices.map((notice) => (
                  <article
                    key={notice.id}
                    className={`activity-item ${notice.urgent && !notice.read ? "needs-attention" : ""}`}
                  >
                    {notice.urgent ? (
                      <Monitor size={20} />
                    ) : (
                      <Check size={20} />
                    )}
                    <div>
                      <strong>{notice.title}</strong>
                      <small>
                        {workflows.find((w) => w.id === notice.workflowId)
                          ?.name || "Workflow"}
                      </small>
                      <p>{notice.body}</p>
                      <button
                        className="secondary-button"
                        disabled={opening}
                        onClick={() => void review(notice)}
                      >
                        {notice.inputRequest && notice.urgent
                          ? "Provide input"
                          : notice.runId
                            ? "Review run"
                            : "Review sign-in"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              {sessions.some((s) => s.status === "working") && (
                <p className="activity-working">
                  Finding sign-in in your browser… You can keep working.
                </p>
              )}
              {error && (
                <p role="alert" className="error-text">
                  {error}
                </p>
              )}
              <button
                className="text-button"
                onClick={() => {
                  setOpen(false);
                  onSettings();
                }}
              >
                Sound & notification settings
              </button>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
