import { z } from "zod";
import { inputFieldSchema, defaultInputFields } from "./input-request";
export const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
export const kinds = [
  "input",
  "agent",
  "browser",
  "decision",
  "handoff",
  "user-input",
  "action",
  "workflow",
  "output",
] as const;
export type Kind = (typeof kinds)[number];
export const providerSchema = z.enum([
  "openai",
  "openrouter",
  "local",
  "codex",
]);
export const dataSchema = z.object({
  kind: z.enum(kinds),
  label: z.string().min(1).max(100),
  description: z.string().max(1000).default(""),
  inputFields: z.array(inputFieldSchema).max(30).default(defaultInputFields),
  prompt: z.string().max(20000).default(""),
  provider: providerSchema.default("openai"),
  model: z.string().max(120).default(""),
  skillIds: z.array(idSchema).max(20).default([]),
  field: z.string().max(200).default("input.approved"),
  operator: z
    .enum(["equals", "contains", "greater_than", "exists"])
    .default("equals"),
  value: z.string().max(2000).default("true"),
  filename: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+\.md$/)
    .default("handoff.md"),
  method: z.enum(["GET", "POST"]).default("GET"),
  url: z.string().max(2000).default(""),
  body: z.string().max(20000).default(""),
  paginate: z.boolean().default(false),
  maxPages: z.number().int().min(1).max(20).default(5),
  authEnv: z
    .string()
    .regex(/^$|^[A-Z][A-Z0-9_]{1,79}$/)
    .default(""),
  browserMode: z.enum(["observe", "interact"]).default("observe"),
  browserSteps: z.number().int().min(1).max(30).default(12),
  workflowId: z.string().max(80).default(""),
  decisionEngine: z.enum(["jev", "rule"]).default("jev"),
  questionType: z.enum(["noul", "choice", "score"]).default("noul"),
  question: z
    .string()
    .max(20000)
    .default(
      "Does the provided context contain enough specific, supported information to complete the task?",
    ),
  criteria: z.string().max(20000).default("{}"),
  jevModel: z.string().max(120).default("jev-latest"),
  threshold: z.number().min(0).max(1).default(0.8),
  failThreshold: z.number().min(0).max(1).default(0.2),
  minConfidence: z.number().min(0).max(1).default(0.7),
  scoreThreshold: z.number().min(0).max(9).default(1.5),
  demoValue: z.number().min(0).max(9).default(0.9),
  demoConfidence: z.number().min(0).max(1).default(0.9),
  demoChoice: z.string().max(80).default("pass"),
  direction: z.enum(["right", "left"]).default("right"),
});
export const nodeSchema = z.object({
  id: idSchema,
  type: z.literal("workflowNode").default("workflowNode"),
  position: z.object({ x: z.number().finite(), y: z.number().finite() }),
  data: dataSchema,
});
export const edgeSchema = z.object({
  id: idSchema,
  source: idSchema,
  target: idSchema,
  sourceHandle: idSchema.nullable().optional(),
  targetHandle: z.string().nullable().optional(),
  label: z.string().optional(),
});
export const workflowSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(1000),
  skillIds: z.array(idSchema).max(20).default([]),
  nodes: z.array(nodeSchema).min(1).max(100),
  edges: z.array(edgeSchema).max(300),
  input: z.string().max(30000).default('{"task":"Your task", "approved":true}'),
});
export type NodeData = z.infer<typeof dataSchema>;
export type Workflow = z.infer<typeof workflowSchema>;
export type WNode = Workflow["nodes"][number];
export type Provider = z.infer<typeof providerSchema>;
export type NodeStatus =
  | "pending"
  | "running"
  | "waiting"
  | "completed"
  | "skipped"
  | "failed"
  | "cancelled";
export type NodeResult = {
  status: NodeStatus;
  startedAt?: string;
  finishedAt?: string;
  output?: unknown;
  error?: string;
  artifact?: string;
  browserUrl?: string;
  durationMs?: number;
  reusedFrom?: string;
  requestId?: string;
  inputDraft?: Record<string, unknown>;
  humanResponse?: Record<string, unknown>;
};
export type Run = {
  id: string;
  workflowId: string;
  workflowName: string;
  mode: "demo" | "live";
  status: "running" | "waiting" | "completed" | "failed" | "cancelled";
  startedAt: string;
  finishedAt?: string;
  nodes: Record<string, NodeResult>;
  events: { time: string; nodeId?: string; message: string }[];
  error?: string;
  workflow: Workflow;
  input?: unknown;
  resumedFrom?: string;
  concurrency?: number;
  scheduleId?: string;
  scheduledAt?: string;
  skillSnapshots?: import("./automation").SkillBundle[];
  workflowSnapshots?: Record<string, Workflow>;
};
export function validateGraph(workflow: Workflow): string[] {
  const errors: string[] = [];
  const ids = new Set(workflow.nodes.map((n) => n.id));
  if (ids.size !== workflow.nodes.length)
    errors.push("Node IDs must be unique.");
  if (new Set(workflow.edges.map((e) => e.id)).size !== workflow.edges.length)
    errors.push("Connection IDs must be unique.");
  const inputs = workflow.nodes.filter((n) => n.data.kind === "input");
  if (inputs.length !== 1)
    errors.push("A workflow needs exactly one input node.");
  if (!workflow.nodes.some((n) => n.data.kind === "output"))
    errors.push("Add an output node.");
  for (const e of workflow.edges) {
    if (!ids.has(e.source) || !ids.has(e.target))
      errors.push("A connection points to a missing node.");
    const source = workflow.nodes.find((n) => n.id === e.source);
    if (
      source?.data.kind === "decision" &&
      (!e.sourceHandle || !decisionPorts(source.data).includes(e.sourceHandle))
    )
      errors.push(
        "Connect decisions using a valid decision port (pass/fail, choice, or review).",
      );
    if (source?.data.kind !== "decision" && e.sourceHandle)
      errors.push("Only decisions have pass/fail ports.");
    if (source?.data.kind === "output")
      errors.push("Output nodes cannot have outgoing connections.");
    if (inputs.some((n) => n.id === e.target))
      errors.push("Input nodes cannot have incoming connections.");
  }
  for (const n of workflow.nodes)
    if (n.data.kind === "action" && n.data.paginate && n.data.method !== "GET")
      errors.push(
        `${n.data.label}: pagination is available for GET requests only.`,
      );
  for (const n of workflow.nodes)
    if (n.data.kind === "decision" && n.data.decisionEngine === "jev") {
      try {
        parseCriteria(n.data);
      } catch (error) {
        errors.push(`${n.data.label}: ${(error as Error).message}`);
      }
      if (!n.data.question.trim())
        errors.push(`${n.data.label}: write a question for Jev.`);
      if (
        n.data.questionType === "noul" &&
        n.data.failThreshold >= n.data.threshold
      )
        errors.push("Noul fail threshold must be below its pass threshold.");
      for (const port of decisionPorts(n.data))
        if (
          !workflow.edges.some(
            (e) => e.source === n.id && e.sourceHandle === port,
          )
        )
          errors.push(`${n.data.label}: connect the “${port}” branch.`);
    }
  for (const n of workflow.nodes.filter((n) => n.data.kind === "user-input")) {
    const fields = n.data.inputFields;
    if (!fields.length)
      errors.push(`${n.data.label}: add at least one question.`);
    if (new Set(fields.map((f) => f.key)).size !== fields.length)
      errors.push(`${n.data.label}: each field needs a unique key.`);
    for (const field of fields) {
      if (
        field.type === "choice" &&
        (!field.options.length ||
          new Set(field.options).size !== field.options.length)
      )
        errors.push(`${field.label}: add unique choices.`);
      if (
        field.min !== undefined &&
        field.max !== undefined &&
        field.min > field.max
      )
        errors.push(`${field.label}: minimum must not exceed maximum.`);
    }
  }
  const visited = new Set<string>(),
    visiting = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) {
      errors.push(
        "Cycles are not supported. Use a separate workflow for another pass.",
      );
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const e of workflow.edges.filter((e) => e.source === id))
      visit(e.target);
    visiting.delete(id);
    visited.add(id);
  };
  for (const n of workflow.nodes) visit(n.id);
  const reachable = new Set<string>();
  const reach = (id: string) => {
    if (reachable.has(id)) return;
    reachable.add(id);
    workflow.edges
      .filter((e) => e.source === id)
      .forEach((e) => reach(e.target));
  };
  inputs.forEach((n) => reach(n.id));
  for (const n of workflow.nodes)
    if (!reachable.has(n.id))
      errors.push(`“${n.data.label}” is not connected to the input.`);
  return [...new Set(errors)];
}
export function makeNode(
  kind: Kind,
  id: string,
  x: number,
  y: number,
  overrides: Partial<NodeData> = {},
): WNode {
  const labels: Record<Kind, string> = {
    input: "Workflow input",
    agent: "Focused agent",
    browser: "Browser task",
    decision: "Jev decision",
    handoff: "Context handoff",
    "user-input": "Ask for input",
    action: "HTTP request",
    workflow: "Nested workflow",
    output: "Final output",
  };
  return nodeSchema.parse({
    id,
    position: { x, y },
    data: { kind, label: labels[kind], ...overrides },
  });
}

export function parseCriteria(
  data: NodeData,
): Record<string, unknown> | unknown[] {
  let value: unknown;
  try {
    value = JSON.parse(data.criteria);
  } catch {
    throw new Error("Criteria must be valid JSON.");
  }
  if (data.questionType === "score") {
    if (
      !Array.isArray(value) ||
      value.length < 2 ||
      value.length > 10 ||
      value.some(
        (v) => typeof v !== "string" && (v === null || typeof v !== "object"),
      )
    )
      throw new Error(
        "Score criteria must be an array of 2–10 descriptive levels.",
      );
    if (data.scoreThreshold > value.length - 1)
      throw new Error("Score threshold exceeds the highest rubric level.");
    return value;
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Criteria must be a JSON object.");
  const entries = Object.entries(value);
  if (
    data.questionType === "choice" &&
    (entries.length < 2 ||
      entries.length > 255 ||
      entries.some(
        ([key]) => !idSchema.safeParse(key).success || key === "review",
      ))
  )
    throw new Error(
      "Choice requires 2–255 named options; “review” is reserved for uncertainty. Use letters, numbers, underscores or hyphens.",
    );
  if (
    data.questionType === "noul" &&
    entries.some(([key]) => key !== "true" && key !== "false")
  )
    throw new Error("Noul criteria can only describe “true” and “false”.");
  if (
    entries.some(
      ([, v]) => v !== null && typeof v !== "string" && typeof v !== "object",
    )
  )
    throw new Error(
      "Criteria descriptions must be text, structured JSON, or null.",
    );
  return value as Record<string, unknown>;
}
export function decisionPorts(data: NodeData): string[] {
  if (data.decisionEngine === "rule") return ["pass", "fail"];
  if (data.questionType === "choice") {
    try {
      return [...Object.keys(parseCriteria(data)), "review"];
    } catch {
      return ["review"];
    }
  }
  return ["pass", "fail", "review"];
}
