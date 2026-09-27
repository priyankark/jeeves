import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  CircleHelp,
  Loader2,
  MessageSquare,
  Play,
  Plus,
  ShieldCheck,
  Square,
  Workflow as WorkflowIcon,
} from "lucide-react";
import type { ChatSession } from "../shared/packages";
import type { Provider, Run, Workflow } from "../shared/schema";
import { api } from "./api";
import { ResultView } from "./ResultView";
import { TaskInput } from "./TaskInput";
import { BrowserSessions } from "./BrowserSessions";
import { BrowserLogin } from "./BrowserLogin";
import { executionOrder } from "../shared/graph-edit";
export function Home({
  workflows,
  mode,
  onMode,
  provider,
  model,
  connected,
  connectionVersion,
  onEdit,
  onExplore,
  onNew,
  onSettings,
  onInspect,
}: {
  workflows: Workflow[];
  mode: "demo" | "live";
  onMode: (m: "demo" | "live") => void;
  provider: Provider;
  model: string;
  connected: boolean;
  connectionVersion: string;
  onEdit: (w: Workflow) => void;
  onExplore: () => void;
  onNew: () => void;
  onSettings: () => void;
  onInspect: (r: Run) => void;
}) {
  const [session, setSession] = useState<ChatSession | null>(null);
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState("");
  const suggestionNames = new Set<string>();
  const suggestions = workflows
    .filter((w) => w.nodes.length > 2)
    .sort(
      (a, b) =>
        Number(/·\s*replay$/i.test(a.name)) -
        Number(/·\s*replay$/i.test(b.name)),
    )
    .filter((w) => {
      const name = w.name
        .replace(/(?:\s*·\s*replay)+$/i, "")
        .trim()
        .toLocaleLowerCase();
      if (suggestionNames.has(name)) return false;
      suggestionNames.add(name);
      return true;
    })
    .slice(0, 3);
  const [signingIn, setSigningIn] = useState<Record<string, boolean>>({});
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false),
    [starting, setStarting] = useState(false),
    [error, setError] = useState("");
  const [run, setRun] = useState<Run | null>(null),
    [deleteOpen, setDeleteOpen] = useState(false);
  const request = useRef<AbortController | null>(null),
    composer = useRef<HTMLTextAreaElement>(null),
    end = useRef<HTMLDivElement>(null);
  const refresh = async () => setChats(await api<ChatSession[]>("/chats"));
  useEffect(() => {
    let alive = true;
    void api<ChatSession[]>("/chats")
      .then(async (items) => {
        if (!alive) return;
        setChats(items);
        const id = localStorage.getItem("jeeves-chat");
        if (id && items.some((c) => c.id === id)) {
          const s = await api<ChatSession>(`/chats/${id}`);
          if (alive) setSession(s);
        }
      })
      .catch((e) => setError(e.message));
    return () => {
      alive = false;
      request.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (session?.plan)
      void api<ChatSession>(`/chats/${session.id}`)
        .then(setSession)
        .catch((e) => setError(e.message));
  }, [connectionVersion]);
  useEffect(() => {
    if (session) {
      localStorage.setItem("jeeves-chat", session.id);
      setInput(JSON.stringify(session.plan?.input ?? {}, null, 2));
    }
  }, [session?.id, session?.revision]);
  useEffect(() => {
    const id = session?.runIds.at(-1);
    if (!id) {
      setRun(null);
      return;
    }
    let active = true;
    const poll = () =>
      api<Run>(`/runs/${id}`)
        .then((r) => {
          if (active) setRun(r);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    void poll();
    const timer = setInterval(poll, 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [session?.id, session?.runIds.length]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [session?.messages.length, thinking]);
  async function send(text = message, workflowId = selected) {
    if (!text.trim() || thinking) return;
    setError("");
    setThinking(true);
    const controller = new AbortController();
    request.current = controller;
    try {
      const next = await api<ChatSession>("/chat", {
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify({
          id: session?.id || crypto.randomUUID(),
          message: text,
          mode,
          provider,
          model,
          ...(workflowId ? { workflowId } : {}),
        }),
      });
      setSession(next);
      setMessage("");
      await refresh();
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      if (request.current === controller) {
        setThinking(false);
        request.current = null;
      }
    }
  }
  async function start() {
    if (!session?.plan) return;
    setStarting(true);
    setError("");
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(input);
      } catch {
        throw new Error(
          "The task input contains invalid JSON. Check quotes and commas, or use the task fields.",
        );
      }
      const r = await api<Run>(`/chats/${session.id}/run`, {
        method: "POST",
        body: JSON.stringify({
          revision: session.revision,
          input: parsed,
          mode,
        }),
      });
      setRun(r);
      setSession(await api<ChatSession>(`/chats/${session.id}`));
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  }
  const clear = () => {
    request.current?.abort();
    setThinking(false);
    setSession(null);
    setRun(null);
    setError("");
    setMessage("");
    setSelected("");
    localStorage.removeItem("jeeves-chat");
    composer.current?.focus();
  };
  const activeRun = run?.status === "running",
    used = !!session?.executions?.[session.revision];
  return (
    <main className="home-page">
      <header className="home-top">
        <div>
          <span className="eyebrow">YOUR LOCAL WORKSPACE</span>
          <strong>Home</strong>
        </div>
        <div className="home-top-actions">
          <label className="sr-only" htmlFor="recent-chat">
            Recent conversations
          </label>
          <select
            id="recent-chat"
            value={session?.id || ""}
            disabled={thinking}
            onChange={(e) => {
              if (e.target.value)
                void api<ChatSession>(`/chats/${e.target.value}`)
                  .then((s) => {
                    setSession(s);
                    setError("");
                  })
                  .catch((e) => setError(e.message));
            }}
          >
            <option value="">Recent conversations</option>
            {chats.map((c) => (
              <option value={c.id} key={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <button className="subtle-button" onClick={clear}>
            <Plus size={16} />
            New chat
          </button>
        </div>
      </header>
      <div className={`home-body ${session ? "has-conversation" : ""}`}>
        {!session && (
          <section className="home-hero">
            <div className="hero-mark">
              <WorkflowIcon size={30} />
            </div>
            <span className="eyebrow">A LITTLE DIRECTION. A LOT DONE.</span>
            <h1>
              What would you like
              <br />
              to set in motion?
            </h1>
            <p>
              Describe your task. Jeeves helps you choose a workflow,
              <br className="wide-only" /> shape its input, and follow the work
              through.
            </p>
            <div className="home-assurances">
              <span>
                <ShieldCheck size={13} />
                Local first
              </span>
              <span>No Jeeves account</span>
              <span>You control each run</span>
            </div>
          </section>
        )}
        {session && (
          <section className="conversation" aria-label="Conversation">
            <div className="conversation-meta">
              <span>Saved on this device</span>
              <button
                disabled={thinking}
                onClick={() => setDeleteOpen((v) => !v)}
              >
                Delete conversation
              </button>
            </div>
            {deleteOpen && (
              <div className="inline-confirm">
                Delete this conversation? Run history stays available.
                <button onClick={() => setDeleteOpen(false)}>Keep</button>
                <button
                  onClick={() =>
                    void api(`/chats/${session.id}`, { method: "DELETE" })
                      .then(() => {
                        setDeleteOpen(false);
                        clear();
                        return refresh();
                      })
                      .catch((e) => setError(e.message))
                  }
                >
                  Delete
                </button>
              </div>
            )}
            {session.messages.map((m, i) => (
              <article key={i} className={`chat-message ${m.role}`}>
                <span className="message-avatar">
                  {m.role === "user" ? "You" : "j."}
                </span>
                <div>
                  <small>{m.role === "user" ? "You" : "Jeeves"}</small>
                  <p>{m.text}</p>
                </div>
              </article>
            ))}
          </section>
        )}
        {thinking && (
          <div className="thinking-state" role="status">
            <Loader2 size={17} className="spin" />
            Preparing your workflow…
            <button
              onClick={() => {
                request.current?.abort();
                setThinking(false);
              }}
            >
              Stop
            </button>
          </div>
        )}
        {error && (
          <div className="home-error" role="alert">
            {error}
            <button onClick={() => setError("")}>Dismiss</button>
          </div>
        )}
        {session?.plan && (
          <section className="chat-plan" aria-label="Workflow run preview">
            <div className="plan-heading">
              <span className="plan-icon">
                <WorkflowIcon size={21} />
              </span>
              <div>
                <span className="eyebrow">
                  {used ? "RUN PREPARED" : "READY FOR YOUR REVIEW"}
                </span>
                <h2>{session.plan.workflow.name}</h2>
              </div>
              <button onClick={() => onEdit(session.plan!.workflow)}>
                Open editor <ArrowUpRight size={15} />
              </button>
            </div>
            <p>{session.plan.workflow.description}</p>
            <div className="plan-facts">
              <span>{session.plan.workflow.nodes.length} steps</span>
              <span>
                {session.plan.requirements.providers.join(" · ") ||
                  "No model required"}
              </span>
              <span>
                {session.plan.requirements.skills.length} assigned skills
              </span>
            </div>
            <details open={!used}>
              <summary>Review task input</summary>
              <label className="sr-only" htmlFor="chat-input">
                Workflow input for chat run
              </label>
              <TaskInput
                value={input}
                onChange={setInput}
                disabled={used || starting}
              />
            </details>
            {session.plan.workflow.nodes
              .filter((n) => n.data.kind === "browser")
              .map((n) => (
                <BrowserLogin
                  key={`${session.plan!.workflow.id}-${n.id}`}
                  workflowId={session.plan!.workflow.id}
                  nodeId={n.id}
                  label={n.data.label}
                  input={input}
                  disabled={starting || activeRun}
                  onBusy={(busy) =>
                    setSigningIn((previous) =>
                      previous[n.id] === busy
                        ? previous
                        : { ...previous, [n.id]: busy },
                    )
                  }
                />
              ))}
            {session.plan.requirements.writes.length > 0 && (
              <div className="action-disclosure">
                <strong>This workflow can change external data</strong>
                {session.plan.requirements.writes.map((w) => (
                  <p key={w}>{w}</p>
                ))}
              </div>
            )}
            {mode === "live" &&
              session.plan.requirements.missing.length > 0 && (
                <div className="home-error">
                  Connect before running live:{" "}
                  {session.plan.requirements.missing.join(", ")}.
                  <button onClick={onSettings}>Open settings</button>
                </div>
              )}
            <div className="plan-footer">
              <span>
                {mode === "demo"
                  ? "Demo simulates models and external actions."
                  : "Live sends task context to the listed providers."}
              </span>
              <button
                className="primary-button"
                disabled={
                  starting ||
                  Object.values(signingIn).some(Boolean) ||
                  used ||
                  thinking ||
                  (mode === "live" &&
                    session.plan.requirements.missing.length > 0)
                }
                onClick={() => void start()}
              >
                <Play size={15} />
                {used
                  ? "Started — see result below"
                  : starting
                    ? "Starting…"
                    : `Run ${mode}`}
              </button>
            </div>
          </section>
        )}
        {run && (
          <section className="home-run" aria-label="Chat run result">
            <div className="plan-heading">
              <span className={`run-state ${run.status}`}>
                {activeRun ? (
                  <Loader2 size={20} className="spin" />
                ) : run.status === "completed" ? (
                  <CheckCircle2 size={20} />
                ) : (
                  <AlertCircle size={20} />
                )}
              </span>
              <div>
                <span className="eyebrow">{run.mode.toUpperCase()} RUN</span>
                <h2>
                  {activeRun
                    ? "Your workflow is working."
                    : run.status === "completed"
                      ? "Your result is ready."
                      : `Run ${run.status}.`}
                </h2>
              </div>
              {activeRun ? (
                <button
                  onClick={() =>
                    void api(`/runs/${run.id}/cancel`, {
                      method: "POST",
                    }).catch((e) => setError(e.message))
                  }
                >
                  <Square size={14} />
                  Stop run
                </button>
              ) : (
                <button onClick={() => onInspect(run)}>
                  Inspect run <ChevronRight size={15} />
                </button>
              )}
            </div>
            <div className="run-progress" aria-label="Run progress">
              {executionOrder(run.workflow).map((n) => (
                <span
                  key={n.id}
                  className={run.nodes[n.id].status}
                  title={`${n.data.label}: ${run.nodes[n.id].status}`}
                />
              ))}
            </div>
            {activeRun && (
              <p role="status">{run.events.at(-1)?.message || "Starting"}</p>
            )}
            {run.error && <p className="home-error">{run.error}</p>}
            <BrowserSessions run={run} />
            {run.status === "completed" &&
              run.workflow.nodes
                .filter(
                  (n) =>
                    n.data.kind === "output" &&
                    run.nodes[n.id].status === "completed",
                )
                .map((n) => (
                  <ResultView
                    key={n.id}
                    name={n.id}
                    value={run.nodes[n.id].output}
                  />
                ))}
          </section>
        )}
        <div ref={end} />
        <form
          className="home-composer"
          aria-label="Chat with Jeeves"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label className="sr-only" htmlFor="home-message">
            Message Jeeves
          </label>
          <textarea
            id="home-message"
            ref={composer}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder={
              session
                ? "Refine the task, or prepare another run…"
                : "Try “Run Research to brief on local AI tools for small teams”"
            }
            disabled={thinking}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <div className="composer-tools">
            <select
              aria-label="Choose workflow for chat"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Let Jeeves find a workflow</option>
              {workflows.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Chat run mode"
              value={mode}
              disabled={thinking || starting}
              onChange={(e) => onMode(e.target.value as "demo" | "live")}
            >
              <option value="demo">Demo</option>
              <option value="live">Live</option>
            </select>
            <button
              className="send-home"
              aria-label="Send to Jeeves"
              disabled={thinking || !message.trim()}
            >
              <ArrowUp size={20} />
            </button>
          </div>
        </form>
        <p className="composer-hint">
          {mode === "live" && connected
            ? `Assistant: ${provider}. Task refinement may send messages and workflow metadata to this provider.`
            : "Local workflow matching · no model calls for chat in demo mode."}{" "}
          <span>Enter to send · Shift+Enter for a new line</span>
        </p>
        {!session?.plan && (
          <section className="home-workflows">
            <div className="section-heading">
              <h2>
                {session ? "Choose a workflow" : "Start with something useful"}
              </h2>
              <button onClick={onExplore}>
                Explore workflows <ArrowUpRight size={14} />
              </button>
            </div>
            <div className="home-workflow-grid">
              {suggestions.map((w) => (
                <button
                  className="workflow-launch-card"
                  key={w.id}
                  onClick={() => {
                    setSelected(w.id);
                    let task = `Run ${w.name}`;
                    try {
                      task = JSON.parse(w.input).task || task;
                    } catch {}
                    void send(task, w.id);
                  }}
                  disabled={thinking}
                >
                  <WorkflowIcon size={20} />
                  <strong>{w.name}</strong>
                  <p>{w.description}</p>
                  <span>
                    {w.nodes.length} steps <ArrowUpRight size={14} />
                  </span>
                </button>
              ))}
            </div>
            <button className="build-own" onClick={onNew}>
              <Plus size={15} />
              Build your own workflow
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
