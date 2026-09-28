import { RunInputRequests } from "./InputRequest";
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
import { WebsiteAccess } from "./WebsiteAccess";
import { useAttention } from "./Attention";
import { FriendlyError } from "./FriendlyError";
import { weeklyDraftPrompt } from "../shared/first-workflow";
import { WorkflowConnection, providerNames } from "./WorkflowConnection";
import type { Providers } from "./Connections";
export function Home({
  workflows,
  mode,
  onMode,
  provider,
  model,
  connected,
  connectionVersion,
  providers,
  onProviders,
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
  providers: Providers;
  onProviders: (providers: Providers) => void;
  onEdit: (w: Workflow) => void;
  onExplore: () => void;
  onNew: () => void;
  onSettings: () => void;
  onInspect: (r: Run) => void;
}) {
  const { publishRun } = useAttention();
  const [session, setSession] = useState<ChatSession | null>(null);
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState("");
  const [intent, setIntent] = useState<"refine" | "new">("refine");
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
  useEffect(() => {
    if (run) publishRun(run);
  }, [run, publishRun]);
  const request = useRef<AbortController | null>(null),
    home = useRef<HTMLElement>(null),
    firstExample = useRef<HTMLButtonElement>(null),
    composer = useRef<HTMLTextAreaElement>(null),
    end = useRef<HTMLDivElement>(null),
    preview = useRef<HTMLElement>(null);
  const refresh = async () => setChats(await api<ChatSession[]>("/chats"));
  const refreshAccess = async () => {
    if (session) setSession(await api<ChatSession>(`/chats/${session.id}`));
  };
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
    let active = true;
    if (session?.plan)
      void api<ChatSession>(`/chats/${session.id}`)
        .then((fresh) => {
          if (active)
            setSession((current) =>
              current?.id === fresh.id &&
              current.revision === fresh.revision &&
              current.plan &&
              fresh.plan
                ? {
                    ...current,
                    plan: {
                      ...current.plan,
                      requirements: fresh.plan.requirements,
                    },
                  }
                : current,
            );
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
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
    setRun(null);
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
    const target = session?.plan && !thinking ? preview.current : end.current;
    const container = target?.closest<HTMLElement>(".home-page");
    if (target && container && (session?.messages.length || thinking)) {
      container.scrollTo({
        top:
          container.scrollTop +
          target.getBoundingClientRect().top -
          container.getBoundingClientRect().top -
          16,
        behavior: "smooth",
      });
    }
  }, [session?.messages.length, thinking]);
  async function send(
    text = message,
    workflowId = selected,
    options: {
      templateId?: "weekly-update";
      mode?: "demo" | "live";
      intent?: "refine" | "new";
      taskInput?: unknown;
    } = {},
  ) {
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
          mode: options.mode ?? mode,
          provider,
          model,
          intent: options.intent ?? intent,
          ...(session?.plan && (options.intent ?? intent) === "refine"
            ? { proposedInput: JSON.parse(input) }
            : {}),
          ...(workflowId ? { workflowId } : {}),
          ...options,
        }),
      });
      setSession(next);
      setMessage("");
      setIntent("refine");
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
    setIntent("refine");
    localStorage.removeItem("jeeves-chat");
    requestAnimationFrame(() => {
      home.current?.scrollTo({ top: 0, behavior: "instant" });
      firstExample.current?.focus({ preventScroll: true });
    });
  };
  const activeRun = run?.status === "running",
    used = !!session?.executions?.[session.revision];
  const previousRun =
    !!run &&
    !!session?.plan &&
    session.executions?.[session.revision] !== run.id;
  const isWeeklyUpdate = session?.plan?.workflow.nodes.some(
    (n) => n.data.prompt === weeklyDraftPrompt,
  );
  const demoOutputs =
    run?.workflow.nodes.filter(
      (n) => n.data.kind === "output" && run.nodes[n.id].status === "completed",
    ) || [];
  const genericSimulation =
    run?.mode === "demo" &&
    demoOutputs.some(
      (n) =>
        typeof run.nodes[n.id].output === "string" &&
        String(run.nodes[n.id].output).startsWith("[Demo ·"),
    );
  const hasBrowserSteps =
    session?.plan &&
    Object.values(session.plan.workflowSnapshots).some((w) =>
      w.nodes.some((n) => n.data.kind === "browser"),
    );
  const handledByConnectionPicker = (missing: string) =>
    !hasBrowserSteps &&
    /^(openai|openrouter|local|codex) (connection|model)$/.test(missing);
  const agentConnectionMissing = session?.plan?.requirements.missing.some(
    handledByConnectionPicker,
  );
  const otherRequirements =
    session?.plan?.requirements.missing.filter(
      (m) => !handledByConnectionPicker(m),
    ) || [];
  let needsNotes = false;
  if (isWeeklyUpdate && mode === "live") {
    try {
      const value = JSON.parse(input);
      needsNotes = typeof value.notes !== "string" || !value.notes.trim();
    } catch {
      needsNotes = true;
    }
  }
  return (
    <main ref={home} className="home-page">
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
            <span className="eyebrow">REPEATABLE WORK. VISIBLE STEPS.</span>
            <h1>Turn repeat work into a workflow.</h1>
            <p>
              Start with a useful result. See how it was made, adjust the steps,
              and run the same process again with new input.
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
        {!session && (
          <section className="first-workflow" aria-label="Your first workflow">
            <div className="first-workflow-copy">
              <span className="eyebrow">TRY IT WITHOUT CONNECTING AI</span>
              <h2>Messy notes. A clear weekly update.</h2>
              <p>
                Follow a short example from project notes to a checked draft you
                can copy. Then try your own notes.
              </p>
              <ol className="first-workflow-steps">
                <li>Review notes</li>
                <li>Draft & check</li>
                <li>Get your update</li>
              </ol>
              <button
                ref={firstExample}
                className="primary-button"
                disabled={thinking}
                onClick={() => {
                  onMode("demo");
                  void send("Show me the weekly update example", "", {
                    templateId: "weekly-update",
                    mode: "demo",
                    intent: "new",
                  });
                }}
              >
                <Play size={15} /> Try the example
              </button>
              <small>
                Sample notes and result · no account or API key needed
              </small>
            </div>
            <div
              className="first-workflow-preview"
              aria-label="Example output preview"
            >
              <span className="eyebrow">WHAT YOU’LL GET · SAMPLE</span>
              <strong>Customer portal · weekly update</strong>
              <h3>Progress</h3>
              <p>Shipped the sign-in page. Fixed mobile navigation.</p>
              <h3>Blockers</h3>
              <p>Waiting for vendor sandbox access.</p>
              <h3>Next week</h3>
              <p>Test billing. Invite five pilot customers.</p>
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
            <WebsiteAccess message={error} onGranted={refreshAccess} />
            <button onClick={() => setError("")}>Dismiss</button>
          </div>
        )}
        {session?.plan && (
          <section
            ref={preview}
            className="chat-plan"
            aria-label="Workflow run preview"
          >
            <div className="plan-heading">
              <span className="plan-icon">
                <WorkflowIcon size={21} />
              </span>
              <div>
                <span className="eyebrow">
                  {used ? "RUN STARTED" : "READY FOR YOUR REVIEW"}
                </span>
                <h2>{session.plan.workflow.name}</h2>
              </div>
              <button onClick={() => onEdit(session.plan!.workflow)}>
                Open editor <ArrowUpRight size={15} />
              </button>
            </div>
            <p>{session.plan.workflow.description}</p>
            <details className="plan-technical-details">
              <summary>
                How this workflow works · {session.plan.workflow.nodes.length}{" "}
                steps
              </summary>
              <ol>
                {executionOrder(session.plan.workflow).map((n) => (
                  <li key={n.id}>{n.data.label}</li>
                ))}
              </ol>
              <p>
                AI services:{" "}
                {session.plan.requirements.providers
                  .map((p) => providerNames[p] || p)
                  .join(" · ") || "None required"}
              </p>
              {session.plan.requirements.skills.length > 0 && (
                <p>{session.plan.requirements.skills.length} assigned skills</p>
              )}
            </details>
            <div className="plan-mode">
              <label>
                Run mode
                <select
                  aria-label="Preview run mode"
                  value={mode}
                  disabled={used || starting || thinking}
                  onChange={(e) => onMode(e.target.value as "demo" | "live")}
                >
                  <option value="demo">Demo — no AI calls</option>
                  <option value="live">Live — use connected AI</option>
                </select>
              </label>
              <p>
                {mode === "demo"
                  ? "Try the process without using an AI service. Demo results are simulated."
                  : "Use your input to generate a new result. Review it before sharing."}
              </p>
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
            {isWeeklyUpdate && mode === "demo" && (
              <p className="sample-disclosure">
                The included notes have a prepared sample result. To generate an
                update from different notes, choose Live and connect one AI
                service.
              </p>
            )}
            {needsNotes && !used && (
              <p className="sample-disclosure">
                Add your project notes above before starting. Include what
                changed, what is blocked, and what comes next.
              </p>
            )}
            {mode === "live" && (
              <WorkflowConnection
                session={session}
                input={input}
                providers={providers}
                onProviders={onProviders}
                onChange={setSession}
                disabled={
                  used ||
                  starting ||
                  thinking ||
                  activeRun ||
                  run?.status === "waiting"
                }
              />
            )}
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
                  {agentConnectionMissing &&
                    "Choose and apply an AI connection above to enable this run. "}
                  {otherRequirements.length > 0 &&
                    `Still needed: ${otherRequirements.join(", ")}.`}
                  {session.plan.requirements.missing.map((missing) => (
                    <WebsiteAccess
                      key={missing}
                      message={missing}
                      onGranted={refreshAccess}
                    />
                  ))}
                  {otherRequirements.length > 0 && (
                    <button onClick={onSettings}>Open settings</button>
                  )}
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
                  needsNotes ||
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
                <span className="eyebrow">
                  {previousRun ? "PREVIOUS " : ""}
                  {run.mode.toUpperCase()} RUN
                </span>
                <h2>
                  {activeRun
                    ? "Your workflow is working."
                    : run.status === "waiting"
                      ? "Your input is needed."
                      : run.status === "completed"
                        ? previousRun
                          ? "Result from the earlier task."
                          : "Your result is ready."
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
            {previousRun && (
              <p className="previous-run-note" role="status">
                This run used an earlier version of your task. Your latest
                changes have not been run yet.
              </p>
            )}
            <details className="run-input-provenance">
              <summary>Task used for this run</summary>
              <pre>{JSON.stringify(run.input, null, 2)}</pre>
            </details>
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
            {run.error && (
              <div className="home-error">
                <FriendlyError message={run.error} />
                <WebsiteAccess message={run.error} onGranted={refreshAccess} />
              </div>
            )}
            <RunInputRequests run={run} onUpdate={setRun} />
            {run.status === "waiting" && (
              <button
                className="text-button"
                onClick={async () => {
                  try {
                    await api(`/runs/${run.id}/cancel`, { method: "POST" });
                    setRun(await api<Run>(`/runs/${run.id}`));
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Stop this run
              </button>
            )}
            <BrowserSessions run={run} />
            {run.status === "completed" && genericSimulation && (
              <p className="sample-disclosure">
                The workflow completed a simulation. No AI generated an answer
                to your task. Choose Live to get a result from your own input.
              </p>
            )}
            {run.status === "completed" && (
              <details className="completed-output" open={!genericSimulation}>
                <summary>
                  {genericSimulation
                    ? "Simulation details"
                    : "Read your result"}
                </summary>
                {demoOutputs.map((n) => (
                  <ResultView
                    key={n.id}
                    name={n.id}
                    value={run.nodes[n.id].output}
                  />
                ))}
              </details>
            )}
            {run.status === "completed" && !previousRun && (
              <div className="result-next-step">
                <div>
                  <strong>
                    {isWeeklyUpdate && run.mode === "demo"
                      ? "Ready to try your own notes?"
                      : "Keep the process. Change the input."}
                  </strong>
                  <p>
                    {isWeeklyUpdate && run.mode === "demo"
                      ? "Use the same draft-and-check workflow with one AI connection."
                      : "Prepare another run without rebuilding your workflow."}
                  </p>
                </div>
                <button
                  className="primary-button"
                  disabled={thinking}
                  onClick={() => {
                    const nextMode = isWeeklyUpdate ? "live" : mode;
                    onMode(nextMode);
                    void send(
                      isWeeklyUpdate
                        ? "Prepare an update from my own notes"
                        : "Prepare another run",
                      "",
                      {
                        mode: nextMode,
                        intent: "new",
                        taskInput: isWeeklyUpdate
                          ? { project: "", notes: "" }
                          : JSON.parse(input),
                      },
                    );
                  }}
                >
                  {isWeeklyUpdate
                    ? "Use my own notes"
                    : "Run again with new input"}
                </button>
              </div>
            )}
          </section>
        )}
        <div ref={end} />
        {session?.plan && (
          <label className="chat-intent">
            This message should
            <select
              aria-label="Message intent"
              value={intent}
              onChange={(e) => setIntent(e.target.value as "refine" | "new")}
              disabled={thinking}
            >
              <option value="refine">Refine the current task</option>
              <option value="new">Start a different task</option>
            </select>
          </label>
        )}
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
                ? intent === "refine"
                  ? "What would you like to change about this task?"
                  : "Describe the new task…"
                : "Or describe work you want to repeat…"
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
