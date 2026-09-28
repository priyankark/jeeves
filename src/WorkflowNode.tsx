import { useEffect } from "react";
import {
  Handle,
  Position,
  useUpdateNodeInternals,
  type NodeProps,
  type Node,
} from "@xyflow/react";
import {
  ArrowDownToLine,
  Bot,
  GitBranch,
  FileText,
  Globe,
  Monitor,
  Workflow,
  ArrowUpRight,
  Check,
  Loader2,
  AlertCircle,
  Circle,
  MessageSquare,
} from "lucide-react";
import {
  decisionPorts,
  type Kind,
  type NodeData,
  type NodeStatus,
} from "../shared/schema";
export const icons = {
  input: ArrowDownToLine,
  agent: Bot,
  browser: Monitor,
  decision: GitBranch,
  handoff: FileText,
  "user-input": MessageSquare,
  action: Globe,
  workflow: Workflow,
  output: ArrowUpRight,
};
export const kindLabels: Record<Kind, string> = {
  input: "Input",
  agent: "Subagent",
  browser: "Browser task",
  decision: "Jev decision",
  handoff: "Handoff",
  "user-input": "Ask for input",
  action: "Action",
  workflow: "Workflow",
  output: "Output",
};
export type CanvasData = NodeData & { status?: NodeStatus };
export type CanvasNode = Node<CanvasData, "workflowNode">;
export function WorkflowNode({ id, data, selected }: NodeProps<CanvasNode>) {
  const Icon = icons[data.kind];
  const ports = decisionPorts(data);
  const updateInternals = useUpdateNodeInternals();
  useEffect(() => {
    updateInternals(id);
  }, [
    id,
    data.criteria,
    data.questionType,
    data.decisionEngine,
    data.direction,
    updateInternals,
  ]);
  const reverse = data.direction === "left";
  return (
    <div
      className={`flow-node ${data.kind} ${selected ? "selected" : ""} ${data.status || ""}`}
    >
      {data.kind !== "input" && (
        <Handle
          type="target"
          position={reverse ? Position.Right : Position.Left}
        />
      )}
      <div className="node-top">
        <span className={`node-icon ${data.kind}`}>
          <Icon size={16} />
        </span>
        <span className="node-kind">
          {data.kind === "decision" && data.decisionEngine === "rule"
            ? "Rule"
            : kindLabels[data.kind]}
        </span>
        <span className={`node-status ${data.status || ""}`}>
          {data.status === "completed" ? (
            <Check size={14} />
          ) : data.status === "running" ? (
            <Loader2 className="spin" size={14} />
          ) : data.status === "failed" ? (
            <AlertCircle size={14} />
          ) : (
            <Circle size={7} />
          )}
        </span>
      </div>
      <strong>{data.label}</strong>
      <p>
        {data.description ||
          (data.kind === "agent" || data.kind === "browser"
            ? "One task. Focused context."
            : "Connect to shape your workflow.")}
      </p>
      <div className="node-bottom">
        {data.kind === "agent" || data.kind === "browser" ? (
          <>
            <span className={`provider-dot ${data.provider}`} />
            {data.provider === "openai"
              ? "OpenAI"
              : data.provider === "openrouter"
                ? "OpenRouter"
                : data.provider === "codex"
                  ? "Codex CLI"
                  : "Local model"}
            <span className="node-model">{data.model || "default model"}</span>
          </>
        ) : data.kind === "user-input" ? (
          `${data.inputFields.length} questions · pauses for you`
        ) : data.kind === "handoff" ? (
          <>
            <FileText size={11} />
            {data.filename}
          </>
        ) : data.kind === "decision" ? (
          <>
            <span className="tiny-dot" />
            {data.decisionEngine === "jev"
              ? `Jev · ${data.questionType} · ${data.questionType === "noul" ? `p ≥ ${data.threshold}` : `confidence ≥ ${data.minConfidence}`}`
              : `${data.field} ${data.operator === "equals" ? "=" : data.operator} ${data.value}`}
          </>
        ) : data.kind === "input" ? (
          "JSON · manual trigger"
        ) : data.kind === "output" ? (
          "Collect connected results"
        ) : data.kind === "action" ? (
          `${data.method} · ${data.url || "Configure endpoint"}`
        ) : (
          "Reusable workflow"
        )}
      </div>
      {data.kind === "decision" ? (
        <>
          {ports.map((port, i) => (
            <span key={port}>
              <Handle
                id={port}
                type="source"
                position={reverse ? Position.Left : Position.Right}
                style={{
                  top: `${20 + (65 * i) / Math.max(1, ports.length - 1)}%`,
                }}
              />
              <span
                className={`port-label ${port} ${reverse ? "reverse" : ""}`}
                style={{
                  top: `${16 + (65 * i) / Math.max(1, ports.length - 1)}%`,
                }}
              >
                {port}
              </span>
            </span>
          ))}
        </>
      ) : (
        data.kind !== "output" && (
          <Handle
            type="source"
            position={reverse ? Position.Left : Position.Right}
          />
        )
      )}
    </div>
  );
}
