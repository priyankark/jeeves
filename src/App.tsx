import { InputFieldEditor, RunInputRequests } from "./InputRequest";
import { useDialogFocus } from "./useDialogFocus";
import { Home } from "./Home";
import { TaskInput } from "./TaskInput";
import {
  AttentionCenter,
  NotificationSettings,
  useAttention,
} from "./Attention";
import { FriendlyError } from "./FriendlyError";
import { WorkflowMarket } from "./WorkflowMarket";
import { WorkflowLibrary } from "./WorkflowLibrary";
import { ShareWorkflow } from "./ShareWorkflow";
import { Schedules } from "./Schedules";
import { Skills } from "./Skills";
import { SkillPicker } from "./SkillPicker";
import type { SkillSummary } from "../shared/automation";
import { useWorkflowHistory } from "./useWorkflowHistory";
import { Connections, type Providers } from "./Connections";
import { Integrations } from "./Integrations";
import { BrowserSessions } from "./BrowserSessions";
import { BrowserLogin } from "./BrowserLogin";
import { ResultView } from "./ResultView";
import { JevResult } from "./JevResult";
import { DecisionFields } from "./DecisionFields";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  useReactFlow,
  useNodesInitialized,
  MarkerType,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from "@xyflow/react";
import {
  ShieldCheck,
  Home as HomeIcon,
  Compass,
  Share2,
  CalendarClock,
  BookOpen,
  Workflow as WorkflowIcon,
  Plus,
  Play,
  Square,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  ArrowUp,
  PanelLeftClose,
  PanelLeftOpen,
  Maximize2,
  Minimize2,
  Menu,
  Focus,
  Bell,
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
  Clock3,
  Settings2,
  Search,
  Command,
  Check,
  X,
  Download,
  Upload,
  Trash2,
  Copy,
  FileText,
  Layers,
  Loader2,
  CircleHelp,
  LayoutGrid,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  SlidersHorizontal,
  Undo2,
  Redo2,
} from "lucide-react";
import {
  WorkflowNode,
  icons,
  kindLabels,
  type CanvasNode,
} from "./WorkflowNode";
import {
  workflowSchema,
  validateGraph,
  makeNode,
  kinds,
  type Workflow,
  type Kind,
  type NodeData,
  type Run,
  type Provider,
} from "../shared/schema";
import { starter, blank, templates } from "../shared/templates";
import { insertStep, executionOrder } from "../shared/graph-edit";
import { WebsiteAccess } from "./WebsiteAccess";
import { api, download, ApiError } from "./api";
const nodeTypes = { workflowNode: WorkflowNode };
const initialProviders: Providers = {
  typesafe: false,
  openai: false,
  openrouter: false,
  local: false,
  codex: false,
  models: { openai: "", openrouter: "", local: "", codex: "" },
};
function layoutPreference(key: string, fallback: boolean) {
  try {
    const value = localStorage.getItem(`jeeves-layout:${key}`);
    return value === null ? fallback : value === "true";
  } catch {
    return fallback;
  }
}
const uid = () => crypto.randomUUID();
const clone = <T,>(v: T): T => structuredClone(v);
const pretty = (value: unknown) =>
  typeof value === "string" ? value : JSON.stringify(value, null, 2);
const descriptions: Record<Kind, string> = {
  input: "Start with a task and structured input.",
  agent: "Give a model one focused job.",
  browser:
    "Give an agent a website task with screenshots and browser controls.",
  decision: "Ask Jev for a typed, confidence-aware decision.",
  handoff: "Write context for the next agent.",
  "user-input": "Pause for answers, then continue with the submitted details.",
  action: "Call an API without an agent loop.",
  workflow: "Compose a saved workflow.",
  output: "Collect the results that matter.",
};
export default function App() {
  const [page, setPage] = useState<"home" | "editor" | "explore" | "workflows">(
    () =>
      location.hash === "#editor"
        ? "editor"
        : location.hash === "#explore"
          ? "explore"
          : location.hash === "#workflows"
            ? "workflows"
            : "home",
  );
  const routeReady = useRef(false);
  useEffect(() => {
    const sync = () =>
      setPage(
        location.hash === "#editor"
          ? "editor"
          : location.hash === "#explore"
            ? "explore"
            : location.hash === "#workflows"
              ? "workflows"
              : "home",
      );
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);
  useEffect(() => {
    const hash = `#${page}`;
    if (location.hash !== hash) {
      if (routeReady.current) window.history.pushState(null, "", hash);
      else window.history.replaceState(null, "", hash);
    }
    routeReady.current = true;
  }, [page]);
  const [workflow, setWorkflow] = useState<Workflow>(clone(starter));
  const [saved, setSaved] = useState<Workflow[]>([]);
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState("Connecting…");
  const [runSnapshot, setRunSnapshot] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [panel, setPanel] = useState<"copilot" | "node" | "run">("copilot");
  const [panelOpen, setPanelOpen] = useState(() =>
    layoutPreference("panel", true),
  );
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    layoutPreference("sidebar", window.innerWidth > 1000),
  );
  const [railOpen, setRailOpen] = useState(() =>
    layoutPreference("rail", true),
  );
  const [focusMode, setFocusMode] = useState(false);
  const [panelExpanded, setPanelExpanded] = useState(false);
  const copilotEnd = useRef<HTMLDivElement>(null);
  const {
    publishRun,
    open: attentionOpen,
    setOpen: setAttentionOpen,
    notices,
  } = useAttention();
  useEffect(() => {
    try {
      for (const [key, value] of Object.entries({
        sidebar: sidebarOpen,
        rail: railOpen,
        panel: panelOpen,
      }))
        localStorage.setItem(`jeeves-layout:${key}`, String(value));
    } catch {}
  }, [sidebarOpen, railOpen, panelOpen]);
  const [modal, setModal] = useState<
    | "nodes"
    | "settings"
    | "history"
    | "templates"
    | "help"
    | "schedules"
    | "share"
    | "skills"
    | null
  >(null);
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const [run, setRun] = useState<Run | null>(null);
  const [history, setHistory] = useState<Run[]>([]);
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const reloadSkills = useCallback(
    async () => setSkills(await api<SkillSummary[]>("/skills")),
    [],
  );
  useEffect(() => {
    void reloadSkills().catch((e) => setError(e.message));
  }, [reloadSkills]);
  const [providers, setProviders] = useState<Providers>(initialProviders);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [chat, setChat] = useState("");
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; text: string }[]
  >([]);
  const [proposal, setProposal] = useState<Workflow | null>(null);
  const [thinking, setThinking] = useState(false);
  const [starting, setStarting] = useState(false);
  const [copilotProvider, setCopilotProvider] = useState<Provider>("openai");
  const [copilotModel, setCopilotModel] = useState("");
  const [nodeSearch, setNodeSearch] = useState("");
  const [showInput, setShowInput] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const saving = useRef<Promise<unknown>>(Promise.resolve());
  const copilotRequest = useRef<AbortController | null>(null);
  const [resumeBusy, setResumeBusy] = useState(false);
  const [resumeWarning, setResumeWarning] = useState("");
  const [outputOpen, setOutputOpen] = useState(false);
  useDialogFocus(!!modal || outputOpen || !!resumeWarning, () => {
    setModal(null);
    setOutputOpen(false);
    setResumeWarning("");
  });
  useDialogFocus(
    panelExpanded && !modal && !outputOpen && !resumeWarning && !attentionOpen,
    () => setPanelExpanded(false),
  );
  useEffect(() => {
    if (run) publishRun(run);
  }, [run, publishRun]);
  useEffect(() => {
    copilotEnd.current?.scrollIntoView({ block: "end", behavior: "instant" });
  }, [messages.length, thinking, proposal, panel]);
  useEffect(() => {
    if (page !== "editor") {
      setPanelExpanded(false);
      setFocusMode(false);
    }
  }, [page]);
  const flow = useReactFlow<CanvasNode>();
  const nodesInitialized = useNodesInitialized();
  const busy =
    starting || run?.status === "running" || run?.status === "waiting";
  const edits = useWorkflowHistory(
    workflow,
    setWorkflow,
    busy || runSnapshot || page !== "editor",
  );
  useEffect(() => {
    let ignore = false;
    Promise.all([
      api<Workflow[]>("/workflows"),
      api<{ providers: Providers }>("/status"),
    ])
      .then(([items, status]) => {
        if (ignore) return;
        items = items.map((w) => workflowSchema.parse(w));
        setSaved(items);
        setProviders(status.providers);
        let chosen = items.find((w) => w.id === starter.id) || items[0];
        try {
          const id = localStorage.getItem("jeeves-workflow");
          chosen = items.find((w) => w.id === id) || chosen;
        } catch {}
        if (chosen) setWorkflow(chosen);
        const preferred =
          (["openai", "codex", "openrouter", "local"] as Provider[]).find(
            (p) => status.providers[p],
          ) || "openai";
        setCopilotProvider(preferred);
        try {
          const stored = JSON.parse(
            localStorage.getItem("jeeves-preferences") || "{}",
          );
          if (
            stored.copilotProvider &&
            status.providers[stored.copilotProvider as Provider]
          )
            setCopilotProvider(stored.copilotProvider);
          if (stored.copilotModel) setCopilotModel(stored.copilotModel);
          if (stored.mode === "demo" || stored.mode === "live")
            setMode(stored.mode);
          else if (
            chosen?.nodes.every(
              (n) =>
                !(n.data.kind === "agent" || n.data.kind === "browser") ||
                status.providers[n.data.provider],
            ) &&
            status.providers.typesafe
          )
            setMode("live");
        } catch {}
        setReady(true);
        setSaveState("Saved locally");
      })
      .catch((e) => setError(e.message));
    return () => {
      ignore = true;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    if (runSnapshot) {
      setSaveState("Run snapshot · edits save a copy");
      return;
    }
    setSaveState("Saving…");
    let current = true;
    const timer = setTimeout(() => {
      saving.current = saving.current
        .catch(() => {})
        .then(() =>
          api<Workflow>(`/workflows/${workflow.id}`, {
            method: "PUT",
            body: JSON.stringify(workflow),
          }),
        )
        .then(() => {
          if (current) {
            setSaveState("Saved locally");
            setSaved((items) => [
              ...items.filter((w) => w.id !== workflow.id),
              workflow,
            ]);
          }
        })
        .catch((e) => {
          if (current) {
            setSaveState("Save failed");
            setError(e.message);
          }
        });
    }, 500);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [workflow, ready, runSnapshot]);
  useEffect(() => {
    if (!run || !["running", "waiting"].includes(run.status)) return;
    let stopped = false;
    const poll = async () => {
      try {
        const next = await api<Run>(`/runs/${run.id}`);
        if (!stopped) setRun(next);
      } catch (e) {
        if (!stopped) setError((e as Error).message);
      }
    };
    const timer = setInterval(poll, 500);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [run?.id, run?.status]);
  useEffect(() => {
    if (ready) {
      try {
        localStorage.setItem(
          "jeeves-preferences",
          JSON.stringify({ mode, copilotProvider, copilotModel }),
        );
      } catch {}
    }
  }, [ready, mode, copilotProvider, copilotModel]);
  useEffect(() => () => copilotRequest.current?.abort(), []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!ready || !nodesInitialized || page !== "editor" || panelExpanded)
      return;
    const frame = requestAnimationFrame(() => {
      void flow.fitView({ padding: 0.1, maxZoom: 1 });
    });
    return () => cancelAnimationFrame(frame);
  }, [
    workflow.id,
    ready,
    nodesInitialized,
    page,
    sidebarOpen,
    railOpen,
    focusMode,
    panelOpen,
    panelExpanded,
  ]);
  const update = (patch: Partial<Workflow>) => {
    setRunSnapshot(false);
    setWorkflow((w) => ({ ...w, ...patch }));
  };
  const inspectRun = async (full: Run) => {
    try {
      await saving.current;
      if (!runSnapshot)
        await api(`/workflows/${workflow.id}`, {
          method: "PUT",
          body: JSON.stringify(workflow),
        });
      copilotRequest.current?.abort();
      setThinking(false);
      setRunSnapshot(true);
      setWorkflow({
        ...clone(full.workflow),
        id: uid(),
        name: ["running", "waiting"].includes(full.status)
          ? full.workflowName
          : `${full.workflowName.replace(/(?:\s*·\s*replay)+$/i, "")} · replay`,
      });
      setRun(full);
      setMode(full.mode);
      setSelected(null);
      setProposal(null);
      setMessages([]);
      setPage("editor");
      setPanel("run");
      setPanelOpen(true);
      setModal(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const chooseWorkflow = async (next: Workflow) => {
    copilotRequest.current?.abort();
    setThinking(false);
    try {
      await saving.current;
      if (!runSnapshot)
        await api(`/workflows/${workflow.id}`, {
          method: "PUT",
          body: JSON.stringify(workflow),
        });
      setRunSnapshot(false);
      setWorkflow(clone(next));
      setPage("editor");
      setSelected(null);
      setRun(null);
      setProposal(null);
      setMessages([]);
      setPanel("copilot");
      try {
        localStorage.setItem("jeeves-workflow", next.id);
      } catch {}
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const newWorkflow = (template: Workflow = blank) => {
    void chooseWorkflow({
      ...clone(template),
      id: uid(),
      name: template === blank ? "Untitled workflow" : `${template.name} copy`,
      nodes: clone(template.nodes).map((n) =>
        n.data.kind === "agent" || n.data.kind === "browser"
          ? {
              ...n,
              data: {
                ...n.data,
                provider: copilotProvider,
                model: copilotModel,
              },
            }
          : n,
      ),
    });
    setModal(null);
  };
  const onNodesChange = useCallback((changes: NodeChange<CanvasNode>[]) => {
    if (changes.some((c) => !["select", "dimensions"].includes(c.type)))
      setRunSnapshot(false);
    setWorkflow((w) => ({
      ...w,
      nodes: applyNodeChanges(
        changes,
        w.nodes as CanvasNode[],
      ) as Workflow["nodes"],
      edges: w.edges.filter(
        (e) =>
          !changes.some(
            (c) =>
              c.type === "remove" && (c.id === e.source || c.id === e.target),
          ),
      ),
    }));
  }, []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    if (changes.some((c) => c.type !== "select")) setRunSnapshot(false);
    setWorkflow((w) => ({
      ...w,
      edges: applyEdgeChanges(changes, w.edges as Edge[]) as Workflow["edges"],
    }));
  }, []);
  const onConnect = useCallback((connection: Connection) => {
    setRunSnapshot(false);
    setWorkflow((w) => ({
      ...w,
      edges: addEdge(
        {
          ...connection,
          id: uid(),
          ...(connection.sourceHandle
            ? { label: connection.sourceHandle }
            : {}),
        },
        w.edges,
      ) as Workflow["edges"],
    }));
  }, []);
  const node = workflow.nodes.find((n) => n.id === selected);
  const patchNode = (patch: Partial<NodeData>) =>
    update({
      nodes: workflow.nodes.map((n) =>
        n.id === selected ? { ...n, data: { ...n.data, ...patch } } : n,
      ),
    });
  const addNode = (kind: Kind) => {
    const id = uid();
    const n = makeNode(kind, id, 0, 0);
    if (kind === "agent" || kind === "browser") {
      n.data.provider = copilotProvider;
      n.data.model = copilotModel;
    }
    const inserted = insertStep(workflow, n, selected);
    update(inserted.workflow);
    setError("");
    setToast(inserted.message);
    setSelected(id);
    setPanel("node");
    setPanelOpen(true);
    setModal(null);
    setTimeout(() => flow.fitView({ padding: 0.18, duration: 250 }), 80);
  };
  async function startRun() {
    setError("");
    const errors = validateGraph(workflow);
    if (errors.length) {
      setError(errors.join(" "));
      return;
    }
    let input: unknown;
    try {
      input = JSON.parse(workflow.input);
    } catch {
      setError("Workflow input must be valid JSON. Open Run input to fix it.");
      setShowInput(true);
      return;
    }
    if (mode === "live") {
      const missing = Array.from(
        new Set(
          workflow.nodes
            .filter(
              (n) =>
                (n.data.kind === "agent" || n.data.kind === "browser") &&
                !providers[n.data.provider],
            )
            .map((n) => n.data.provider),
        ),
      );
      if (
        workflow.nodes.some(
          (n) => n.data.kind === "decision" && n.data.decisionEngine === "jev",
        ) &&
        !providers.typesafe
      )
        missing.push("typesafe" as Provider);
      if (missing.length) {
        setError(
          `Connect ${missing.join(", ")} in Settings before running this workflow live.`,
        );
        setModal("settings");
        return;
      }
    }
    setRunSnapshot(false);
    setStarting(true);
    try {
      const r = await api<Run>("/runs", {
        method: "POST",
        body: JSON.stringify({ workflow, mode, input }),
      });
      setRun(r);
      setPanel("run");
      setPanelOpen(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  }
  async function askCopilot(text = chat) {
    if (!text.trim() || thinking) return;
    setChat("");
    setMessages((m) => [...m, { role: "user", text }]);
    setThinking(true);
    const controller = new AbortController();
    copilotRequest.current = controller;
    setProposal(null);
    try {
      const response = await api<{ message: string; workflow: Workflow }>(
        "/copilot",
        {
          method: "POST",
          signal: controller.signal,
          body: JSON.stringify({
            message: text,
            workflow: proposal || workflow,
            mode,
            provider: copilotProvider,
            model: copilotModel,
          }),
        },
      );
      if (controller.signal.aborted) return;
      setMessages((m) => [...m, { role: "assistant", text: response.message }]);
      setProposal(response.workflow);
    } catch (e) {
      if (controller.signal.aborted) return;
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: `I couldn't prepare that workflow: ${(e as Error).message}`,
        },
      ]);
    } finally {
      if (copilotRequest.current === controller) setThinking(false);
    }
  }
  async function resumeExecution(confirmActions = false) {
    if (!run) return;
    setResumeBusy(true);
    setError("");
    try {
      const resumed = await api<Run>(`/runs/${run.id}/resume`, {
        method: "POST",
        body: JSON.stringify({ confirmActions }),
      });
      setRun(resumed);
      setResumeWarning("");
      setPanel("run");
      setToast("Resuming from the last completed step.");
    } catch (e) {
      if (e instanceof ApiError && e.details.requiresActionConfirmation)
        setResumeWarning(e.message);
      else setError((e as Error).message);
    } finally {
      setResumeBusy(false);
    }
  }
  async function openHistory() {
    setModal("history");
    try {
      setHistory(await api<Run[]>("/runs"));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const nodeResult = node && run?.nodes[node.id];
  const shownNodes: CanvasNode[] = workflow.nodes.map((n) => ({
    ...n,
    selected: n.id === selected,
    data: { ...n.data, status: run?.nodes[n.id]?.status },
  }));
  const shownEdges = workflow.edges.map((e) => {
    const color = (e as Edge).selected
      ? "#b94d22"
      : e.sourceHandle === "fail"
        ? "#91623b"
        : run?.nodes[e.source]?.status === "completed"
          ? "#387348"
          : "#687863";
    return {
      ...e,
      label: undefined,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 20,
        height: 20,
        color,
      },
      type: "smoothstep",
      animated: run?.nodes[e.source]?.status === "running",
      style: {
        stroke: color,
      },
      labelStyle: { fill: "#7b8577", fontSize: 11 },
      labelBgStyle: { fill: "#f7f8f4" },
    };
  });
  return (
    <div className={`app-shell ${focusMode ? "focus-mode" : ""}`}>
      <nav
        className="rail"
        aria-label="Main navigation"
        hidden={!railOpen || focusMode}
        inert={panelExpanded || undefined}
      >
        <button
          className="brand"
          title="Jeeves home"
          onClick={() => {
            setPage("home");
            setModal(null);
          }}
        >
          <img
            src="/jeeves-icon.png"
            alt="Jeeves home"
            width="44"
            height="44"
          />
        </button>
        <div className="rail-top">
          <button
            className={`rail-button ${page === "home" ? "active" : ""}`}
            title="Home"
            aria-label="Home"
            onClick={() => {
              setPage("home");
              setModal(null);
            }}
          >
            <HomeIcon size={21} />
          </button>
          <button
            className={`rail-button ${page === "explore" ? "active" : ""}`}
            title="Explore workflows"
            aria-label="Explore workflows"
            onClick={() => {
              setPage("explore");
              setModal(null);
            }}
          >
            <Compass size={21} />
          </button>
          <button
            className="rail-button"
            title="Schedules"
            aria-label="Schedules"
            onClick={() => setModal("schedules")}
          >
            <CalendarClock size={20} />
          </button>
          <button
            className="rail-button"
            title="Skills"
            aria-label="Skills"
            onClick={() => {
              void reloadSkills().catch((e) => setError(e.message));
              setModal("skills");
            }}
          >
            <BookOpen size={20} />
          </button>
          <button
            className={`rail-button ${page === "workflows" || page === "editor" ? "active" : ""}`}
            title="Workflows"
            aria-label="Workflows"
            onClick={() => {
              setPage("workflows");
              setModal(null);
            }}
          >
            <WorkflowIcon size={21} />
          </button>
          <button
            className="rail-button"
            title="Run history"
            aria-label="Run history"
            onClick={openHistory}
          >
            <Clock3 size={20} />
          </button>
          <button
            className="rail-button"
            title="Templates"
            aria-label="Templates"
            onClick={() => setModal("templates")}
          >
            <Layers size={20} />
          </button>
        </div>
        <div className="rail-bottom">
          <button
            className="rail-button"
            title="Help"
            aria-label="Help"
            onClick={() => setModal("help")}
          >
            <CircleHelp size={20} />
          </button>
          <button
            className="rail-button"
            title="Settings"
            aria-label="Settings"
            onClick={() => setModal("settings")}
          >
            <Settings2 size={20} />
          </button>
          <div className="avatar" title="Local workspace">
            <ShieldCheck size={18} />
          </div>
        </div>
      </nav>
      <aside
        className="sidebar"
        aria-label="Workspace sidebar"
        hidden={!sidebarOpen || focusMode}
        inert={panelExpanded || undefined}
      >
        <div className="workspace-heading">
          <span className="workspace-icon">
            <Command size={16} />
          </span>
          <div>
            Personal workspace<small>Local workspace</small>
          </div>
          <button
            className="icon-button"
            aria-label="Hide workspace sidebar"
            title="Hide workspace sidebar"
            onClick={() => setSidebarOpen(false)}
          >
            <PanelLeftClose size={16} />
          </button>
        </div>
        <div className="sidebar-section-label">WORKSPACE</div>
        <button
          className={`sidebar-main ${page === "home" ? "active" : ""}`}
          onClick={() => {
            setPage("home");
            setModal(null);
          }}
        >
          <HomeIcon size={17} />
          Home
        </button>
        <button
          className={`sidebar-main ${page === "explore" ? "active" : ""}`}
          onClick={() => {
            setPage("explore");
            setModal(null);
          }}
        >
          <Compass size={17} />
          Explore
        </button>
        <button
          className={`sidebar-main ${page === "workflows" || page === "editor" ? "active" : ""}`}
          onClick={() => {
            setPage("workflows");
            setModal(null);
          }}
        >
          <WorkflowIcon size={17} /> Workflows <span>{saved.length}</span>
        </button>
        <button className="sidebar-main" onClick={openHistory}>
          <Clock3 size={17} /> Run history <ArrowUpRight size={13} />
        </button>
        <div className="sidebar-section-label workflow-label">
          YOUR WORKFLOWS
          <button
            title="New workflow"
            aria-label="New workflow"
            disabled={busy || !ready}
            onClick={() => newWorkflow()}
          >
            <Plus size={15} />
          </button>
        </div>
        <div className="workflow-list">
          {saved.map((w) => (
            <button
              disabled={busy}
              className={`workflow-link ${w.id === workflow.id && page === "editor" ? "active" : ""}`}
              key={w.id}
              onClick={() => chooseWorkflow(w)}
            >
              <span className="workflow-indicator" />
              <span>{w.name}</span>
              {w.id === workflow.id && <ChevronRight size={13} />}
            </button>
          ))}
        </div>
        <button
          className="new-workflow"
          disabled={busy || !ready}
          onClick={() => newWorkflow()}
        >
          <Plus size={15} /> New workflow
        </button>
        <div className="sidebar-note">
          <span className="mini-logo">
            <WorkflowIcon size={18} />
          </span>
          <strong>Small tasks. Big possibilities.</strong>
          <p>Build with focused agents. Let the workflow connect the dots.</p>
          <button onClick={() => setModal("templates")}>
            Explore templates <ArrowUpRight size={13} />
          </button>
        </div>
        <div className="local-status">
          <span className={`tiny-dot ${ready ? "" : "offline"}`} />
          {ready ? "Local engine connected" : "Connecting to engine"}
          <span>v0.1</span>
        </div>
      </aside>
      <div className="workspace-content">
        <div className="workspace-bar" inert={panelExpanded || undefined}>
          <div className="workspace-layout-controls">
            <button
              className="icon-button"
              aria-label={
                railOpen && !focusMode
                  ? "Hide navigation rail"
                  : "Show navigation rail"
              }
              title={
                railOpen && !focusMode
                  ? "Hide navigation rail"
                  : "Show navigation rail"
              }
              aria-pressed={railOpen && !focusMode}
              onClick={() => {
                if (focusMode) {
                  setFocusMode(false);
                  setRailOpen(true);
                } else setRailOpen((v) => !v);
              }}
            >
              <Menu size={18} />
            </button>
            <button
              className="icon-button"
              aria-label={
                sidebarOpen && !focusMode
                  ? "Collapse workspace sidebar"
                  : "Show workspace sidebar"
              }
              title={
                sidebarOpen && !focusMode
                  ? "Collapse workspace sidebar"
                  : "Show workspace sidebar"
              }
              aria-pressed={sidebarOpen && !focusMode}
              onClick={() => {
                if (focusMode) {
                  setFocusMode(false);
                  setSidebarOpen(true);
                } else setSidebarOpen((v) => !v);
              }}
            >
              {sidebarOpen && !focusMode ? (
                <PanelLeftClose size={18} />
              ) : (
                <PanelLeftOpen size={18} />
              )}
            </button>
            {page === "editor" && (
              <button
                className={`focus-button ${focusMode ? "active" : ""}`}
                aria-pressed={focusMode}
                onClick={() => setFocusMode((v) => !v)}
              >
                <Focus size={16} />
                {focusMode ? "Exit focus" : "Focus canvas"}
              </button>
            )}
          </div>
          <div className="workspace-attention">
            <AttentionCenter
              workflows={saved}
              onSettings={() => setModal("settings")}
              onReview={async (notice) => {
                if (
                  run?.status === "running" &&
                  notice.workflowId !== run.workflowId
                )
                  throw new Error(
                    "Wait for the current run to finish before switching workflows.",
                  );
                if (notice.runId) {
                  const requestedRun = await api<Run>(`/runs/${notice.runId}`);
                  await inspectRun(requestedRun);
                  if (requestedRun.status === "waiting") setPanelExpanded(true);
                } else {
                  if (notice.workflowId !== workflow.id) {
                    const items = await api<Workflow[]>("/workflows");
                    const target = items.find(
                      (w) => w.id === notice.workflowId,
                    );
                    if (!target)
                      throw new Error(
                        "This workflow is no longer in your library.",
                      );
                    await chooseWorkflow(target);
                  }
                  setPage("editor");
                  setSelected(notice.nodeId || null);
                  setPanel("node");
                  setPanelOpen(true);
                  setTimeout(
                    () =>
                      document
                        .querySelector(".inspector .browser-login")
                        ?.scrollIntoView({ block: "center" }),
                    100,
                  );
                }
                setFocusMode(false);
              }}
            />
            <button
              className="icon-button"
              aria-label="Workspace preferences"
              title="Workspace preferences"
              onClick={() => setModal("settings")}
            >
              <Settings2 size={17} />
            </button>
          </div>
        </div>
        {page === "home" && (
          <Home
            workflows={saved}
            mode={mode}
            onMode={setMode}
            provider={copilotProvider}
            model={copilotModel}
            connected={!!providers[copilotProvider]}
            connectionVersion={JSON.stringify(providers)}
            onEdit={(w) => void chooseWorkflow(w)}
            onExplore={() => setPage("explore")}
            onNew={() => newWorkflow()}
            onSettings={() => setModal("settings")}
            onInspect={(r) => void inspectRun(r)}
          />
        )}
        {page === "explore" && (
          <WorkflowMarket
            onInstalled={() => {
              void api<Workflow[]>("/workflows").then(setSaved);
              void reloadSkills();
            }}
            onEdit={(w) => void chooseWorkflow(w)}
            onContribute={() => setModal("share")}
          />
        )}
        {page === "workflows" && (
          <WorkflowLibrary
            workflows={saved}
            ready={ready}
            busy={busy}
            onOpen={(w) => void chooseWorkflow(w)}
            onNew={() => newWorkflow()}
            onExplore={() => setPage("explore")}
          />
        )}
        <main
          className="main"
          style={page !== "editor" ? { display: "none" } : undefined}
        >
          <header className="topbar" inert={panelExpanded || undefined}>
            <div className="breadcrumbs">
              <WorkflowIcon size={15} />
              <button
                className="breadcrumb-link"
                onClick={() => setPage("workflows")}
              >
                Workflows
              </button>
              <ChevronRight size={13} />
              <strong>{workflow.name}</strong>
            </div>
            <div className="topbar-actions">
              <span className="save-state">
                {saveState === "Saved locally" ? (
                  <Check size={13} />
                ) : (
                  <Clock3 size={13} />
                )}{" "}
                {saveState}
              </span>
              {runSnapshot && !busy && (
                <button
                  className="subtle-button"
                  onClick={() => setRunSnapshot(false)}
                >
                  Save a copy
                </button>
              )}
              <button
                className="subtle-button"
                title="Share or export"
                aria-label="Share or export"
                onClick={() => setModal("share")}
              >
                <Share2 size={16} />
                Share / Export
              </button>
              <button
                className="icon-button"
                title="Export workflow"
                aria-label="Export workflow"
                onClick={() =>
                  download(
                    `${workflow.id}.json`,
                    JSON.stringify(workflow, null, 2),
                  )
                }
              >
                <Download size={17} />
              </button>
              <button
                className="icon-button"
                title="Import workflow"
                aria-label="Import workflow"
                disabled={busy}
                onClick={() => importRef.current?.click()}
              >
                <Upload size={17} />
              </button>
              <button
                className="icon-button"
                title="Toggle side panel"
                aria-label="Toggle side panel"
                onClick={() => setPanelOpen((v) => !v)}
              >
                {panelOpen ? (
                  <PanelRightClose size={18} />
                ) : (
                  <PanelRightOpen size={18} />
                )}
              </button>
            </div>
          </header>
          <div className="editor-heading" inert={panelExpanded || undefined}>
            <div>
              <div className="title-line">
                <input
                  aria-label="Workflow name"
                  value={workflow.name}
                  disabled={busy}
                  onChange={(e) => update({ name: e.target.value })}
                />
                <span className="draft-badge">LOCAL</span>
              </div>
              <input
                className="workflow-description"
                aria-label="Workflow description"
                value={workflow.description}
                disabled={busy}
                onChange={(e) => update({ description: e.target.value })}
              />
            </div>
            <div className="run-actions">
              <div className="mode-select">
                <span className={`tiny-dot ${mode === "live" ? "live" : ""}`} />
                <select
                  aria-label="Run mode"
                  disabled={busy}
                  value={mode}
                  onChange={(e) => setMode(e.target.value as "demo" | "live")}
                >
                  <option value="demo">Demo mode</option>
                  <option value="live">Live mode</option>
                </select>
              </div>
              {busy ? (
                <button
                  className="run-button stop"
                  onClick={() =>
                    run &&
                    api(`/runs/${run.id}/cancel`, { method: "POST" }).catch(
                      (e) => setError(e.message),
                    )
                  }
                >
                  <Square size={13} /> Stop run
                </button>
              ) : (
                <button
                  className="run-button"
                  disabled={!ready}
                  onClick={startRun}
                >
                  <Play size={14} fill="currentColor" /> Run workflow
                </button>
              )}
            </div>
          </div>
          <div className="editor-toolbar" inert={panelExpanded || undefined}>
            <div className="editor-tab">
              <WorkflowIcon size={15} /> Editor{" "}
              <span>{workflow.nodes.length}</span>
            </div>
            <button
              className="toolbar-button"
              onClick={() => setShowInput((v) => !v)}
            >
              <SlidersHorizontal size={14} /> Run input
            </button>
            <div className="toolbar-spacer" />
            <div className="history-controls">
              <button
                className="icon-button"
                aria-label="Undo edit"
                title="Undo · ⌘Z"
                disabled={!edits.canUndo || busy}
                onClick={edits.undo}
              >
                <Undo2 size={15} />
              </button>
              <button
                className="icon-button"
                aria-label="Redo edit"
                title="Redo · ⇧⌘Z"
                disabled={!edits.canRedo || busy}
                onClick={edits.redo}
              >
                <Redo2 size={15} />
              </button>
            </div>
            <button
              className="toolbar-button"
              onClick={() => {
                const errors = validateGraph(workflow);
                if (errors.length) setError(errors.join(" "));
                else setToast("Workflow is valid and ready to run.");
              }}
            >
              <CheckCircle2 size={14} /> Validate
            </button>
            <button
              className="add-node-button"
              disabled={busy}
              onClick={() => setModal("nodes")}
            >
              <Plus size={15} /> Add node
            </button>
          </div>
          {error && (
            <div className="error-banner" role="alert">
              <AlertCircle size={16} />
              <div>
                <FriendlyError message={error} />
                <WebsiteAccess message={error} />
              </div>
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          <div className="editor-body">
            <section
              className="canvas-section"
              aria-label="Workflow canvas"
              inert={panelExpanded || undefined}
            >
              <ReactFlow<CanvasNode>
                nodes={shownNodes}
                edges={shownEdges}
                nodeTypes={nodeTypes}
                onNodesChange={busy ? undefined : onNodesChange}
                onEdgesChange={busy ? undefined : onEdgesChange}
                onConnect={busy ? undefined : onConnect}
                onNodeClick={(_, n) => {
                  setFocusMode(false);
                  setSelected(n.id);
                  setPanel("node");
                  setPanelOpen(true);
                }}
                onPaneClick={() => setSelected(null)}
                onEdgeClick={() => setSelected(null)}
                nodesDraggable={!busy}
                nodesConnectable={!busy}
                deleteKeyCode={busy ? null : ["Backspace", "Delete"]}
                fitView
                fitViewOptions={{ padding: 0.18 }}
                minZoom={0.25}
                maxZoom={1.6}
                proOptions={{ hideAttribution: true }}
              >
                <Background
                  variant={BackgroundVariant.Dots}
                  gap={22}
                  size={1}
                  color="#d5dbd0"
                />
                <Controls showInteractive={false} />
                <MiniMap
                  nodeColor={(n) =>
                    n.data.kind === "decision"
                      ? "#d9c495"
                      : n.data.kind === "handoff"
                        ? "#bec8dd"
                        : "#bbcab2"
                  }
                  maskColor="rgba(247,248,244,.75)"
                  pannable
                  zoomable
                />
              </ReactFlow>
              <div className="canvas-label">
                <span className="tiny-dot" />{" "}
                {mode === "demo"
                  ? "SANDBOX · NO API CALLS"
                  : "LIVE · CONNECTED PROVIDERS"}
              </div>
              <div className="canvas-hint">
                Drag to arrange <span>·</span> Connect ports to build{" "}
                <span>·</span> Scroll to zoom
              </div>
              {showInput && (
                <div className="input-popover">
                  <div className="panel-title">
                    <strong>Workflow input</strong>
                    <button
                      className="icon-button"
                      aria-label="Close run input"
                      onClick={() => setShowInput(false)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <p>The task and context passed into this run.</p>
                  <TaskInput
                    value={workflow.input}
                    onChange={(input) => update({ input })}
                    disabled={!!busy}
                    sourceLabel="Workflow input JSON"
                  />
                </div>
              )}
            </section>
            {panelOpen && !focusMode && (
              <aside
                className={`right-panel ${panelExpanded ? "panel-expanded" : ""}`}
                role={panelExpanded ? "dialog" : "complementary"}
                aria-modal={panelExpanded || undefined}
                aria-label={
                  panelExpanded ? "Expanded workspace panel" : "Workspace panel"
                }
              >
                <div className="panel-window-controls">
                  <span>
                    {panelExpanded ? workflow.name : "Workspace tools"}
                  </span>
                  {panelExpanded && (
                    <button
                      className="activity-button"
                      onClick={() => setAttentionOpen(true)}
                    >
                      <Bell size={17} />
                      Activity
                      {notices.some((n) => !n.read) && (
                        <b>{notices.filter((n) => !n.read).length}</b>
                      )}
                    </button>
                  )}
                  <button
                    className="icon-button"
                    aria-label={
                      panelExpanded
                        ? "Restore side panel"
                        : "Expand panel to full screen"
                    }
                    title={
                      panelExpanded
                        ? "Restore side panel · Escape"
                        : "Expand panel to full screen"
                    }
                    onClick={() => setPanelExpanded((v) => !v)}
                  >
                    {panelExpanded ? (
                      <Minimize2 size={17} />
                    ) : (
                      <Maximize2 size={17} />
                    )}
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Close workspace panel"
                    title="Close workspace panel"
                    onClick={() => {
                      setPanelExpanded(false);
                      setPanelOpen(false);
                    }}
                  >
                    <X size={17} />
                  </button>
                </div>
                <div className="panel-tabs">
                  <button
                    className={panel === "copilot" ? "active" : ""}
                    onClick={() => setPanel("copilot")}
                  >
                    <Sparkles size={15} /> Copilot
                  </button>
                  <button
                    className={panel === "node" ? "active" : ""}
                    onClick={() => setPanel("node")}
                  >
                    <Settings2 size={14} /> Inspector
                  </button>
                  <button
                    className={panel === "run" ? "active" : ""}
                    onClick={() => setPanel("run")}
                  >
                    <Clock3 size={14} /> Run
                  </button>
                </div>
                {panel === "copilot" && (
                  <>
                    <div className="copilot-content">
                      {messages.length === 0 && (
                        <>
                          <div className="copilot-mark">
                            <Sparkles size={23} />
                          </div>
                          <div className="eyebrow">
                            A LITTLE HELP, A LOT OF POSSIBILITY
                          </div>
                          <h2>From an idea to a working flow.</h2>
                          <p className="copilot-intro">
                            Tell me what you want to accomplish. We’ll give
                            every agent a clear role, and connect the steps.
                          </p>
                        </>
                      )}
                      {messages.length === 0 && (
                        <div className="suggestions">
                          <span>START WITH AN IDEA</span>
                          {[
                            "Research a topic and write a brief",
                            "Draft something, then have it reviewed",
                          ].map((text) => (
                            <button
                              key={text}
                              disabled={busy || !ready}
                              onClick={() => askCopilot(text)}
                            >
                              {text}
                              <ArrowUpRight size={15} />
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="chat-messages">
                        {messages.map((m, i) => (
                          <div key={i} className={`chat-message ${m.role}`}>
                            <span>{m.role === "user" ? "You" : "Jeeves"}</span>
                            <p>{m.text}</p>
                          </div>
                        ))}
                        {thinking && (
                          <div className="thinking" role="status">
                            <Loader2 size={15} className="spin" /> Designing
                            your workflow… This can take up to two minutes.
                          </div>
                        )}
                        {proposal && (
                          <div className="proposal">
                            <span>
                              <WorkflowIcon size={16} /> Workflow proposal
                            </span>
                            <strong>{proposal.name}</strong>
                            <small>
                              {proposal.nodes.length} nodes ·{" "}
                              {proposal.edges.length} connections
                            </small>
                            <button
                              className="primary-button"
                              disabled={busy}
                              onClick={() => {
                                setRunSnapshot(false);
                                setWorkflow(proposal);
                                setProposal(null);
                                setRun(null);
                                setToast("Proposal applied to the canvas.");
                                setTimeout(
                                  () =>
                                    flow.fitView({
                                      padding: 0.18,
                                      duration: 400,
                                    }),
                                  100,
                                );
                              }}
                            >
                              Apply to canvas <ArrowUpRight size={14} />
                            </button>
                            <button
                              className="text-button"
                              onClick={() => setProposal(null)}
                            >
                              Dismiss
                            </button>
                          </div>
                        )}
                      </div>
                      <div ref={copilotEnd} />
                    </div>
                    <div className="copilot-composer">
                      <div className="compose-box">
                        <textarea
                          aria-label="Message copilot"
                          placeholder="What should your workflow do?"
                          value={chat}
                          disabled={thinking || busy}
                          onChange={(e) => setChat(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              askCopilot();
                            }
                          }}
                        />
                        <div>
                          <span>
                            {mode === "demo"
                              ? "Local template assistant"
                              : `${copilotProvider} copilot`}
                          </span>
                          {thinking ? (
                            <button
                              aria-label="Stop designing"
                              title="Stop designing"
                              onClick={() => {
                                copilotRequest.current?.abort();
                                copilotRequest.current = null;
                                setThinking(false);
                                setChat(
                                  [...messages]
                                    .reverse()
                                    .find((m) => m.role === "user")?.text || "",
                                );
                                setMessages((m) => [
                                  ...m,
                                  {
                                    role: "assistant",
                                    text: "Stopped designing. Your request is ready to edit and try again.",
                                  },
                                ]);
                              }}
                            >
                              <Square size={17} />
                            </button>
                          ) : (
                            <button
                              aria-label="Send message"
                              disabled={
                                !chat.trim() || thinking || busy || !ready
                              }
                              onClick={() => askCopilot()}
                            >
                              <ArrowUp size={17} />
                            </button>
                          )}
                        </div>
                      </div>
                      <small>
                        {mode === "demo"
                          ? "Demo uses templates. Live uses your configured model."
                          : "Proposals are reviewed before they change your canvas."}
                      </small>
                    </div>
                  </>
                )}
                {panel === "node" && (
                  <div className="inspector panel-scroll">
                    {node ? (
                      <>
                        <div className="inspector-heading">
                          <span className={`node-icon ${node.data.kind}`}>
                            {(() => {
                              const Icon = icons[node.data.kind];
                              return <Icon size={20} />;
                            })()}
                          </span>
                          <div>
                            <span className="eyebrow">
                              {kindLabels[node.data.kind]}
                            </span>
                            <h2>{node.data.label}</h2>
                          </div>
                        </div>
                        <p>{descriptions[node.data.kind]}</p>
                        <fieldset disabled={busy}>
                          <label>
                            Node name
                            <input
                              value={node.data.label}
                              onChange={(e) =>
                                patchNode({ label: e.target.value })
                              }
                            />
                          </label>
                          <label>
                            Description
                            <input
                              value={node.data.description}
                              onChange={(e) =>
                                patchNode({ description: e.target.value })
                              }
                            />
                          </label>
                          {(node.data.kind === "agent" ||
                            node.data.kind === "browser") && (
                            <>
                              <label>
                                Harness / provider
                                <select
                                  value={node.data.provider}
                                  onChange={(e) =>
                                    patchNode({
                                      provider: e.target.value as Provider,
                                      model: "",
                                    })
                                  }
                                >
                                  {(
                                    [
                                      "openai",
                                      "openrouter",
                                      "local",
                                      "codex",
                                    ] as const
                                  ).map((p) => (
                                    <option key={p} value={p}>
                                      {p === "codex"
                                        ? "Codex CLI"
                                        : p === "local"
                                          ? "Local / open-source"
                                          : p === "openai"
                                            ? "OpenAI"
                                            : "OpenRouter"}
                                      {providers[p] ? " · configured" : ""}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                Model
                                <input
                                  placeholder={
                                    providers.models[node.data.provider] ||
                                    "Provider model ID"
                                  }
                                  value={node.data.model}
                                  onChange={(e) =>
                                    patchNode({ model: e.target.value })
                                  }
                                />
                              </label>
                              <div>
                                <h3>Agent skills</h3>
                                <SkillPicker
                                  skills={skills}
                                  selected={node.data.skillIds || []}
                                  inherited={workflow.skillIds || []}
                                  disabled={busy}
                                  onChange={(skillIds) =>
                                    patchNode({ skillIds })
                                  }
                                />
                                <button
                                  type="button"
                                  onClick={() => setModal("skills")}
                                >
                                  Browse skills
                                </button>
                              </div>
                              <label>
                                Instructions
                                <textarea
                                  rows={7}
                                  placeholder="Give this agent one focused task…"
                                  value={node.data.prompt}
                                  onChange={(e) =>
                                    patchNode({ prompt: e.target.value })
                                  }
                                />
                              </label>
                              <div className="field-note">
                                Receives the run input and outputs from directly
                                connected upstream nodes.
                              </div>
                            </>
                          )}
                          {node.data.kind === "workflow" && (
                            <div>
                              <h3>Skills for nested agents</h3>
                              <SkillPicker
                                skills={skills}
                                selected={node.data.skillIds || []}
                                inherited={workflow.skillIds || []}
                                disabled={busy}
                                onChange={(skillIds) => patchNode({ skillIds })}
                              />
                            </div>
                          )}
                          {node.data.kind === "user-input" && (
                            <>
                              <label>
                                Request message
                                <textarea
                                  rows={3}
                                  value={node.data.prompt}
                                  placeholder="What do you need to know before continuing?"
                                  onChange={(e) =>
                                    patchNode({ prompt: e.target.value })
                                  }
                                />
                              </label>
                              <InputFieldEditor
                                fields={node.data.inputFields}
                                onChange={(inputFields) =>
                                  patchNode({ inputFields })
                                }
                              />
                            </>
                          )}
                          {node.data.kind === "browser" && (
                            <>
                              <label>
                                Starting website
                                <input
                                  aria-label="Starting website"
                                  value={node.data.url}
                                  placeholder="https://example.com"
                                  onChange={(e) =>
                                    patchNode({ url: e.target.value })
                                  }
                                />
                              </label>
                              <label>
                                Browser access
                                <select
                                  aria-label="Browser access"
                                  value={node.data.browserMode}
                                  onChange={(e) =>
                                    patchNode({
                                      browserMode: e.target.value as
                                        "observe" | "interact",
                                    })
                                  }
                                >
                                  <option value="observe">
                                    Observe page only
                                  </option>
                                  <option value="interact">
                                    Interact · clicks and form entry
                                  </option>
                                </select>
                              </label>
                              <label>
                                Maximum browser steps
                                <input
                                  type="number"
                                  min={1}
                                  max={30}
                                  value={node.data.browserSteps}
                                  onChange={(e) =>
                                    patchNode({
                                      browserSteps: Math.max(
                                        1,
                                        Math.min(
                                          30,
                                          Number(e.target.value) || 1,
                                        ),
                                      ),
                                    })
                                  }
                                />
                              </label>
                              <p className="field-note">
                                Requires Google Chrome and website access in
                                Settings. Codex sees screenshots; other
                                providers use page text and controls. Checkout,
                                payment, publishing and sensitive forms are
                                handed back for manual review. The browser keeps
                                a separate local profile for this step.
                              </p>
                              <BrowserLogin
                                key={`${workflow.id}-${node.id}`}
                                workflowId={workflow.id}
                                nodeId={node.id}
                                label={node.data.label}
                                input={workflow.input}
                                disabled={busy}
                                beforeStart={() =>
                                  api(`/workflows/${workflow.id}`, {
                                    method: "PUT",
                                    body: JSON.stringify(workflow),
                                  })
                                }
                              />
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void api(`/workflows/${workflow.id}`, {
                                    method: "PUT",
                                    body: JSON.stringify(workflow),
                                  })
                                    .then(() =>
                                      api("/browser/open", {
                                        method: "POST",
                                        body: JSON.stringify({
                                          workflowId: workflow.id,
                                          nodeId: node.id,
                                        }),
                                      }),
                                    )
                                    .catch((e) => setError(e.message))
                                }
                              >
                                Open workflow browser for login or review
                              </button>
                            </>
                          )}
                          {node.data.kind === "decision" && (
                            <DecisionFields
                              data={node.data}
                              onChange={patchNode}
                            />
                          )}
                          {node.data.kind === "handoff" && (
                            <>
                              <label>
                                Markdown filename
                                <input
                                  value={node.data.filename}
                                  onChange={(e) =>
                                    patchNode({ filename: e.target.value })
                                  }
                                />
                              </label>
                              <div className="field-note">
                                Each run writes a separate file with the task
                                and connected context. Downstream nodes receive
                                the filename and contents.
                              </div>
                            </>
                          )}
                          {node.data.kind === "action" && (
                            <>
                              <label>
                                Method
                                <select
                                  aria-label="HTTP method"
                                  value={node.data.method}
                                  onChange={(e) =>
                                    patchNode({
                                      method: e.target.value as "GET" | "POST",
                                      ...(e.target.value === "POST"
                                        ? { paginate: false }
                                        : {}),
                                    })
                                  }
                                >
                                  <option>GET</option>
                                  <option>POST</option>
                                </select>
                              </label>
                              <label>
                                Endpoint URL
                                <input
                                  placeholder="https://api.example.com/resource"
                                  value={node.data.url}
                                  onChange={(e) =>
                                    patchNode({ url: e.target.value })
                                  }
                                />
                              </label>
                              <label>
                                Bearer credential name
                                <input
                                  aria-label="Bearer credential name"
                                  value={node.data.authEnv}
                                  placeholder="Optional · GITHUB_TOKEN"
                                  onChange={(e) =>
                                    patchNode({ authEnv: e.target.value })
                                  }
                                />
                              </label>
                              {node.data.method === "GET" && (
                                <>
                                  <label className="pagination-toggle">
                                    <input
                                      type="checkbox"
                                      checked={node.data.paginate || false}
                                      onChange={(e) =>
                                        patchNode({
                                          paginate: e.target.checked,
                                        })
                                      }
                                    />
                                    Follow API pagination
                                  </label>
                                  {node.data.paginate && (
                                    <label>
                                      Maximum pages
                                      <input
                                        type="number"
                                        min={1}
                                        max={20}
                                        value={node.data.maxPages || 5}
                                        onChange={(e) =>
                                          patchNode({
                                            maxPages: Math.max(
                                              1,
                                              Math.min(
                                                20,
                                                Number(e.target.value) || 1,
                                              ),
                                            ),
                                          })
                                        }
                                      />
                                    </label>
                                  )}
                                  {node.data.paginate && (
                                    <p className="field-note">
                                      Follows same-site Link headers. Output
                                      includes items and pagination details;
                                      reaching the limit is marked as a partial
                                      result.
                                    </p>
                                  )}
                                </>
                              )}
                              {node.data.method === "POST" && (
                                <label>
                                  JSON body
                                  <textarea
                                    rows={5}
                                    placeholder="Leave empty to send connected context"
                                    value={node.data.body}
                                    onChange={(e) =>
                                      patchNode({ body: e.target.value })
                                    }
                                  />
                                </label>
                              )}
                              <div className="field-note">
                                Configure website access and named credentials
                                in Settings. Use {"{{input.owner}}"} in URLs or
                                JSON strings to insert task input. URL values
                                are encoded; JSON preserves types. Demo makes no
                                requests.
                              </div>
                            </>
                          )}
                          {node.data.kind === "workflow" && (
                            <>
                              <label>
                                Saved workflow
                                <select
                                  value={node.data.workflowId}
                                  onChange={(e) =>
                                    patchNode({ workflowId: e.target.value })
                                  }
                                >
                                  <option value="">Choose a workflow</option>
                                  {saved
                                    .filter((w) => w.id !== workflow.id)
                                    .map((w) => (
                                      <option key={w.id} value={w.id}>
                                        {w.name}
                                      </option>
                                    ))}
                                </select>
                              </label>
                              <div className="field-note">
                                The child receives <code>input</code>,{" "}
                                <code>parents</code>, and <code>previous</code>{" "}
                                from this node. Child runs appear in history.
                              </div>
                            </>
                          )}
                          {node.data.kind === "input" && (
                            <div>
                              <h3>Run input</h3>
                              <TaskInput
                                value={workflow.input}
                                onChange={(input) => update({ input })}
                                disabled={!!busy}
                                sourceLabel="Run input (JSON)"
                              />
                            </div>
                          )}
                        </fieldset>
                        {nodeResult && (
                          <div className="node-result">
                            <div className="section-heading">
                              LAST RUN{" "}
                              <span
                                className={`status-badge ${nodeResult.status}`}
                              >
                                {nodeResult.status}
                              </span>
                            </div>
                            {nodeResult.error && (
                              <>
                                <FriendlyError message={nodeResult.error} />
                                <WebsiteAccess
                                  key={run?.id}
                                  message={nodeResult.error}
                                  onRetry={
                                    run &&
                                    ["failed", "cancelled"].includes(run.status)
                                      ? () => resumeExecution()
                                      : undefined
                                  }
                                />
                              </>
                            )}
                            <JevResult value={nodeResult.output} />
                            {nodeResult.output !== undefined && (
                              <ResultView
                                value={nodeResult.output}
                                name={node?.id || "output"}
                              />
                            )}
                            {nodeResult.artifact && (
                              <a
                                className="artifact-link"
                                href={`/api/artifacts/${nodeResult.artifact}`}
                              >
                                <Download size={14} />{" "}
                                {nodeResult.artifact.endsWith(".png")
                                  ? "Download browser screenshot"
                                  : "Download handoff"}
                              </a>
                            )}
                          </div>
                        )}
                        <div className="inspector-actions">
                          <button
                            className="secondary-button"
                            disabled={busy || node.data.kind === "input"}
                            onClick={() => {
                              const copy = {
                                ...clone(node),
                                id: uid(),
                                position: {
                                  x: node.position.x + 35,
                                  y: node.position.y + 170,
                                },
                                data: {
                                  ...node.data,
                                  label: `${node.data.label} copy`,
                                },
                              };
                              update({ nodes: [...workflow.nodes, copy] });
                              setSelected(copy.id);
                            }}
                          >
                            <Copy size={14} /> Duplicate
                          </button>
                          <button
                            className="danger-button"
                            disabled={busy}
                            onClick={() => {
                              update({
                                nodes: workflow.nodes.filter(
                                  (n) => n.id !== node.id,
                                ),
                                edges: workflow.edges.filter(
                                  (e) =>
                                    e.source !== node.id &&
                                    e.target !== node.id,
                                ),
                              });
                              setSelected(null);
                            }}
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="empty-panel">
                        <Settings2 size={30} />
                        <h3>A place for the details.</h3>
                        <p>
                          Select a node on the canvas to configure its role,
                          model, and context.
                        </p>
                        <button
                          className="secondary-button"
                          onClick={() => setModal("nodes")}
                        >
                          <Plus size={14} /> Add a node
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {panel === "run" && (
                  <div className="run-panel panel-scroll">
                    {run ? (
                      <>
                        <div className="run-summary">
                          <div className="eyebrow">
                            {run.mode.toUpperCase()} EXECUTION
                          </div>
                          <h2>
                            {run.status === "running"
                              ? "Your flow is running."
                              : run.status === "waiting"
                                ? "Your input is needed."
                                : run.status === "completed"
                                  ? "Everything connected."
                                  : run.status === "cancelled"
                                    ? "Run stopped."
                                    : "A step needs attention."}
                          </h2>
                          <span className={`status-badge ${run.status}`}>
                            {run.status === "running" && (
                              <Loader2 size={12} className="spin" />
                            )}
                            {run.status}
                          </span>
                          <span className="run-time">
                            {new Date(run.startedAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <RunInputRequests run={run} onUpdate={setRun} />
                        {run.status === "waiting" && (
                          <button
                            className="text-button"
                            onClick={async () => {
                              try {
                                await api(`/runs/${run.id}/cancel`, {
                                  method: "POST",
                                });
                                setRun(await api<Run>(`/runs/${run.id}`));
                              } catch (e) {
                                setError((e as Error).message);
                              }
                            }}
                          >
                            Stop this run
                          </button>
                        )}
                        {run.mode === "demo" && (
                          <div className="demo-notice">
                            Agent responses and Jev answers are simulated.
                            Routing and handoff files are real.
                          </div>
                        )}
                        {run.error && (
                          <>
                            <FriendlyError message={run.error} />
                            <WebsiteAccess
                              key={run.id}
                              message={run.error}
                              onRetry={() => resumeExecution()}
                            />
                          </>
                        )}
                        {run.resumedFrom && (
                          <div className="checkpoint-note">
                            <RotateCcw size={13} /> Reused completed steps from
                            the previous run.
                          </div>
                        )}
                        {run.status === "completed" && (
                          <button
                            className="primary-button full-width"
                            onClick={() => setOutputOpen(true)}
                          >
                            <FileText size={14} /> Read final output
                          </button>
                        )}
                        <BrowserSessions run={run} />
                        {(run.status === "failed" ||
                          run.status === "cancelled") && (
                          <button
                            className="primary-button full-width"
                            disabled={resumeBusy}
                            onClick={() => resumeExecution()}
                          >
                            {resumeBusy ? (
                              <Loader2 className="spin" size={14} />
                            ) : (
                              <RotateCcw size={14} />
                            )}
                            Resume from checkpoint
                          </button>
                        )}
                        <div className="section-heading">EXECUTION TRACE</div>
                        <div className="trace">
                          {executionOrder(run.workflow).map((n) => {
                            const result = run.nodes[n.id];
                            return (
                              <button
                                className={`trace-item ${result?.status}`}
                                key={n.id}
                                onClick={() => {
                                  setSelected(n.id);
                                  setPanel("node");
                                }}
                              >
                                <span className="trace-icon">
                                  {result?.status === "completed" ? (
                                    <Check size={14} />
                                  ) : result?.status === "running" ? (
                                    <Loader2 size={14} className="spin" />
                                  ) : result?.status === "failed" ? (
                                    <AlertCircle size={14} />
                                  ) : (
                                    <span />
                                  )}
                                </span>
                                <span>
                                  <strong>{n.data.label}</strong>
                                  <small>
                                    {result?.status || "pending"}
                                    {result?.reusedFrom
                                      ? " · checkpoint"
                                      : result?.durationMs !== undefined
                                        ? ` · ${(result.durationMs / 1000).toFixed(1)}s`
                                        : ""}
                                  </small>
                                </span>
                                <ChevronRight size={13} />
                              </button>
                            );
                          })}
                        </div>
                        <div className="run-events">
                          {run.events.slice(-6).map((e, i) => (
                            <div key={i}>
                              <time>
                                {new Date(e.time).toLocaleTimeString([], {
                                  hour12: false,
                                })}
                              </time>
                              <span>{e.message}</span>
                            </div>
                          ))}
                        </div>
                        {run.status !== "running" && (
                          <button
                            className="secondary-button full-width"
                            onClick={() =>
                              download(
                                `run-${run.id}.json`,
                                JSON.stringify(run, null, 2),
                              )
                            }
                          >
                            <Download size={14} /> Export run
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="empty-panel">
                        <Play size={30} />
                        <h3>See your idea in motion.</h3>
                        <p>
                          Run your workflow to follow each step, inspect
                          outputs, and download handoffs.
                        </p>
                        <button
                          className="primary-button"
                          disabled={!ready}
                          onClick={startRun}
                        >
                          <Play size={14} /> Run workflow
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </aside>
            )}
          </div>
          <footer className="editor-footer">
            <span>
              <span className="tiny-dot" />
              {workflow.nodes.length} nodes{" "}
              <span className="footer-divider">/</span> {workflow.edges.length}{" "}
              connections
            </span>
            <span>
              {run?.status === "waiting"
                ? "Waiting for your input · progress saved"
                : busy
                  ? "Executing workflow…"
                  : "Your context. Your models. Your workflow."}
              <span className="footer-shortcut">JEEVES</span>
            </span>
          </footer>
        </main>
      </div>
      <input
        ref={importRef}
        type="file"
        accept=".json"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            if (file.size > 1_000_000)
              throw new Error("Workflow file must be under 1 MB.");
            const imported = workflowSchema.parse(
              JSON.parse(await file.text()),
            );
            newWorkflow(imported);
            setToast("Workflow imported as a new copy.");
          } catch (err) {
            setError(`Import failed: ${(err as Error).message}`);
          }
          e.target.value = "";
        }}
      />
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={17} />
          {toast}
        </div>
      )}
      {resumeWarning && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm action retry"
          >
            <div className="modal-heading">
              <div>
                <div className="eyebrow">RECOVER A STOPPED RUN</div>
                <h2>Check the action before retrying.</h2>
              </div>
            </div>
            <p className="modal-intro">{resumeWarning}</p>
            <div className="inspector-actions">
              <button
                className="secondary-button"
                onClick={() => setResumeWarning("")}
              >
                Keep stopped
              </button>
              <button
                className="primary-button"
                disabled={resumeBusy}
                onClick={() => resumeExecution(true)}
              >
                Retry uncertain action
              </button>
            </div>
          </section>
        </div>
      )}
      {outputOpen && run && (
        <div className="modal-backdrop" onClick={() => setOutputOpen(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Workflow output"
            className="modal output-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <div className="eyebrow">
                  {run.mode.toUpperCase()} RUN · {run.status.toUpperCase()}
                </div>
                <h2>{run.workflowName}</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Close output"
                onClick={() => setOutputOpen(false)}
              >
                <X size={19} />
              </button>
            </div>
            {run.workflow.nodes
              .filter(
                (n) =>
                  n.data.kind === "output" &&
                  run.nodes[n.id]?.status === "completed",
              )
              .map((n) => (
                <section key={n.id}>
                  <h3>{n.data.label}</h3>
                  <ResultView value={run.nodes[n.id].output} name={n.id} />
                </section>
              ))}
          </section>
        </div>
      )}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <section
            className={`modal ${modal === "settings" ? "settings-modal" : ""} ${modal === "skills" || modal === "schedules" || modal === "share" ? "automation-modal" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={
              modal === "share"
                ? "Share workflow"
                : modal === "skills"
                  ? "Skills library"
                  : modal === "schedules"
                    ? "Workflow schedules"
                    : modal === "nodes"
                      ? "Add a node"
                      : modal === "settings"
                        ? "Workspace settings"
                        : modal === "history"
                          ? "Run history"
                          : modal === "templates"
                            ? "Workflow templates"
                            : "Getting started"
            }
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <div className="eyebrow">YOUR WORKFLOW, YOUR WAY</div>
                <h2>
                  {modal === "share"
                    ? "Let your workflow travel."
                    : modal === "skills"
                      ? "Give every agent a new skill."
                      : modal === "schedules"
                        ? "Good work, on a schedule."
                        : modal === "nodes"
                          ? "One building block at a time."
                          : modal === "settings"
                            ? "Connect your intelligence."
                            : modal === "history"
                              ? "Every run tells a story."
                              : modal === "templates"
                                ? "A head start for your next idea."
                                : "Meet your new workspace."}
                </h2>
              </div>
              <button
                className="icon-button"
                aria-label="Close dialog"
                onClick={() => setModal(null)}
              >
                <X size={19} />
              </button>
            </div>
            {modal === "share" && (
              <ShareWorkflow workflow={workflow} workflows={saved} />
            )}
            {modal === "skills" && (
              <Skills
                skills={skills}
                reload={reloadSkills}
                selected={workflow.skillIds || []}
                onSelect={(skillIds) => update({ skillIds })}
                disabled={!!busy}
              />
            )}
            {modal === "schedules" && (
              <Schedules
                workflow={workflow}
                mode={mode}
                openRun={async (id) => {
                  const full = await api<Run>(`/runs/${id}`);
                  if (busy)
                    throw new Error(
                      "Wait for the current run to finish before opening another run.",
                    );
                  await inspectRun(full);
                }}
              />
            )}
            {modal === "nodes" && (
              <>
                <div className="search-box">
                  <Search size={17} />
                  <input
                    autoFocus
                    placeholder="Find a building block…"
                    aria-label="Search nodes"
                    value={nodeSearch}
                    onChange={(e) => setNodeSearch(e.target.value)}
                  />
                </div>
                <div className="node-library">
                  {kinds
                    .filter((k) =>
                      `${kindLabels[k]} ${descriptions[k]}`
                        .toLowerCase()
                        .includes(nodeSearch.toLowerCase()),
                    )
                    .map((kind) => {
                      const Icon = icons[kind];
                      return (
                        <button
                          key={kind}
                          disabled={busy}
                          onClick={() => addNode(kind)}
                        >
                          <span className={`node-icon ${kind}`}>
                            <Icon size={20} />
                          </span>
                          <span>
                            <strong>{kindLabels[kind]}</strong>
                            <small>{descriptions[kind]}</small>
                          </span>
                          <Plus size={16} />
                        </button>
                      );
                    })}
                </div>
              </>
            )}
            {modal === "templates" && (
              <div className="template-grid">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    disabled={busy || !ready}
                    onClick={() => newWorkflow(t)}
                  >
                    <div className="template-art">
                      <WorkflowIcon size={35} />
                      <span />
                      <FileText size={27} />
                      <span />
                      <CheckCircle2 size={29} />
                    </div>
                    <h3>{t.name}</h3>
                    <p>{t.description}</p>
                    <small>
                      {t.nodes.length} nodes <ArrowUpRight size={15} />
                    </small>
                  </button>
                ))}
                <button
                  className="blank-template"
                  disabled={busy || !ready}
                  onClick={() => newWorkflow()}
                >
                  <Plus size={25} />
                  <h3>Start from a blank canvas</h3>
                  <p>Make room for your own idea.</p>
                </button>
              </div>
            )}
            {modal === "settings" && (
              <>
                <NotificationSettings />
                <Connections providers={providers} onChange={setProviders} />
                <Integrations
                  onChange={() =>
                    setProviders((p) => ({
                      ...p,
                      configurationVersion: Date.now(),
                    }))
                  }
                />
                <div className="settings-fields">
                  <label>
                    Copilot provider
                    <select
                      value={copilotProvider}
                      onChange={(e) =>
                        setCopilotProvider(e.target.value as Provider)
                      }
                    >
                      <option value="openai">OpenAI</option>
                      <option value="openrouter">OpenRouter</option>
                      <option value="local">Local model</option>
                      <option value="codex">Codex CLI</option>
                    </select>
                  </label>
                  <label>
                    Copilot model
                    <input
                      value={copilotModel}
                      onChange={(e) => setCopilotModel(e.target.value)}
                      placeholder={
                        providers.models[copilotProvider] || "Provider default"
                      }
                    />
                  </label>
                </div>
                <button
                  className="secondary-button"
                  onClick={() =>
                    api<{ providers: Providers }>("/status")
                      .then((s) => {
                        setProviders(s.providers);
                        setToast("Provider status refreshed.");
                      })
                      .catch((e) => setError(e.message))
                  }
                >
                  <RotateCcw size={14} /> Refresh connection status
                </button>
              </>
            )}
            {modal === "history" && (
              <div className="history-list">
                {history.length ? (
                  history.map((r) => (
                    <button
                      key={r.id}
                      disabled={busy}
                      onClick={async () => {
                        try {
                          const full = await api<Run>(`/runs/${r.id}`);
                          await inspectRun(full);
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      <Clock3 size={20} />
                      <span>
                        <strong>{r.workflowName}</strong>
                        <small>
                          {new Date(r.startedAt).toLocaleString()} · {r.mode}
                          {r.scheduleId ? " · Scheduled" : ""}
                        </small>
                      </span>
                      <span className={`status-badge ${r.status}`}>
                        {r.status}
                      </span>
                      <ChevronRight size={16} />
                    </button>
                  ))
                ) : (
                  <div className="empty-panel">
                    <Clock3 size={30} />
                    <h3>A fresh start.</h3>
                    <p>Your completed and stopped runs will appear here.</p>
                  </div>
                )}
              </div>
            )}
            {modal === "help" && (
              <div className="help-content">
                <p>
                  Jeeves connects focused agents through explicit context. Start
                  with the research template, then make it yours.
                </p>
                <ol>
                  <li>
                    <strong>Shape the flow.</strong> Add nodes and drag between
                    their ports. Select a node to configure it.
                  </li>
                  <li>
                    <strong>Set the task.</strong> Open Run input and edit the
                    JSON. Jev evaluates the connected state and routes on
                    probability or confidence.
                  </li>
                  <li>
                    <strong>Try a demo.</strong> Run the graph without keys.
                    Inspect routing, outputs, and handoff files.
                  </li>
                  <li>
                    <strong>Bring a model.</strong> Configure a provider in
                    Settings, select Live mode, and run real tasks.
                  </li>
                </ol>
                <div className="field-note">
                  Delete selected nodes or connections with Backspace. Drag the
                  canvas to pan and use the controls to zoom. Workflows autosave
                  locally.
                </div>
                <button
                  className="primary-button"
                  onClick={() => setModal(null)}
                >
                  Let’s build <ArrowUpRight size={15} />
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
