import { browserReviewFields, validateAnswers } from "../shared/input-request";
import { resolveSkills } from "./skills";
import { randomUUID } from "node:crypto";
import { sampleAgentOutput } from "./demo-output";
import { decide } from "./jev";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  validateGraph,
  type Workflow,
  type Run,
  type WNode,
} from "../shared/schema";
import { generate, dataDir } from "./providers";
import { getWorkflow, saveJson } from "./storage";
import { runBrowserTask, BrowserTaskError } from "./browser";
import { executeHttpAction } from "./http-action";
export type Context = {
  input: unknown;
  parents: Record<string, unknown>;
  previous: unknown;
};
export function getField(context: unknown, field: string): unknown {
  return field
    .split(".")
    .reduce<unknown>(
      (value, key) =>
        value !== null && typeof value === "object" && Object.hasOwn(value, key)
          ? (value as Record<string, unknown>)[key]
          : undefined,
      context,
    );
}
export function evaluate(context: Context, node: WNode): boolean {
  const actual = getField(context, node.data.field),
    expected = node.data.value;
  switch (node.data.operator) {
    case "exists":
      return actual !== undefined && actual !== null;
    case "contains":
      return typeof actual === "string"
        ? actual.includes(expected)
        : Array.isArray(actual) &&
            actual.some((item) => String(item) === expected);
    case "greater_than":
      return (
        actual !== null &&
        actual !== undefined &&
        Number.isFinite(Number(actual)) &&
        Number.isFinite(Number(expected)) &&
        Number(actual) > Number(expected)
      );
    case "equals":
      return actual !== undefined && String(actual) === expected;
  }
}
export async function snapshotWorkflowTree(
  workflow: Workflow,
): Promise<Record<string, Workflow>> {
  const snapshots: Record<string, Workflow> = Object.create(null);
  const visit = async (current: Workflow, stack: string[]) => {
    if (stack.includes(current.id) || stack.length >= 5)
      throw new Error(
        "Recursive workflows or nesting beyond five levels are not supported.",
      );
    if (stack.length && current.nodes.some((n) => n.data.kind === "user-input"))
      throw new Error(
        "Place Ask for input in the parent workflow before the nested workflow.",
      );
    const errors = validateGraph(current);
    if (errors.length) throw new Error(`${current.name}: ${errors.join(" ")}`);
    snapshots[current.id] = structuredClone(current);
    for (const node of current.nodes.filter(
      (n) => n.data.kind === "workflow",
    )) {
      const child = Object.hasOwn(snapshots, node.data.workflowId)
        ? snapshots[node.data.workflowId]
        : await getWorkflow(node.data.workflowId);
      await visit(child, [...stack, current.id]);
    }
  };
  await visit(workflow, []);
  return snapshots;
}
export async function prepareRun(run: Run) {
  run.workflowSnapshots ??= await snapshotWorkflowTree(run.workflow);
  if (!run.skillSnapshots) {
    const ids = Object.values(run.workflowSnapshots).flatMap((w) => [
      ...(w.skillIds || []),
      ...w.nodes.flatMap((n) => n.data.skillIds || []),
    ]);
    run.skillSnapshots = await resolveSkills(ids);
  }
}
export function createRun(
  workflow: Workflow,
  mode: "demo" | "live",
  id: string,
): Run {
  return {
    id,
    workflowId: workflow.id,
    workflowName: workflow.name,
    workflow,
    mode,
    status: "running",
    startedAt: new Date().toISOString(),
    nodes: Object.fromEntries(
      workflow.nodes.map((n) => [n.id, { status: "pending" }]),
    ),
    events: [],
  };
}
const asText = (value: unknown) =>
  typeof value === "string" ? value : JSON.stringify(value, null, 2);
async function executeNode(
  node: WNode,
  context: Context,
  run: Run,
  signal: AbortSignal,
  stack: string[],
): Promise<{ output: unknown; artifact?: string }> {
  const d = node.data;
  if (d.kind === "input") return { output: context.input };
  if (d.kind === "output") return { output: context.previous };
  if (d.kind === "decision") {
    if (d.decisionEngine === "jev")
      return { output: await decide(d, context, run.mode, signal) };
    const pass = evaluate(context, node);
    return {
      output: {
        pass,
        route: pass ? "pass" : "fail",
        engine: "rule",
        rule: `${d.field} ${d.operator} ${d.value}`,
        context: context.previous,
      },
    };
  }
  if (d.kind === "handoff") {
    const content = `# ${d.label}\n\n## Task\n${asText(context.input)}\n\n## Connected context\n${asText(context.previous)}\n`;
    const name = `${run.id}-${node.id}-${d.filename}`;
    await mkdir(path.join(dataDir, "artifacts"), { recursive: true });
    await writeFile(path.join(dataDir, "artifacts", name), content, {
      mode: 0o600,
    });
    return { output: { filename: d.filename, content }, artifact: name };
  }
  if (d.kind === "workflow") {
    if (stack.length >= 5 || stack.includes(d.workflowId))
      throw new Error(
        "Recursive workflows or nesting beyond five levels are not supported.",
      );
    const nested = structuredClone(
      run.workflowSnapshots &&
        Object.hasOwn(run.workflowSnapshots, d.workflowId)
        ? run.workflowSnapshots[d.workflowId]
        : await getWorkflow(d.workflowId),
    );
    nested.skillIds = [
      ...new Set([
        ...(run.workflow.skillIds || []),
        ...(d.skillIds || []),
        ...(nested.skillIds || []),
      ]),
    ];
    const errors = validateGraph(nested);
    if (errors.length) throw new Error(errors.join(" "));
    const child = createRun(nested, run.mode, randomUUID());
    child.workflowSnapshots = run.workflowSnapshots;
    child.skillSnapshots = run.skillSnapshots;
    await executeRun(child, context, signal, [...stack, d.workflowId]);
    if (child.status !== "completed")
      throw new Error(child.error || `Nested workflow ${child.status}.`);
    return {
      output: {
        runId: child.id,
        results: Object.fromEntries(
          nested.nodes
            .filter((n) => n.data.kind === "output")
            .map((n) => [n.id, child.nodes[n.id].output]),
        ),
      },
    };
  }
  if (d.kind === "agent") {
    if (run.mode === "demo") {
      return {
        output:
          sampleAgentOutput(d.prompt, context.input, run.workflow) ??
          `[Demo · ${d.label}]\n\nTask: ${asText(context.input)}\n\nInstructions: ${d.prompt || "Complete this focused task."}\n\nAssigned skills: ${
            (run.skillSnapshots || [])
              .filter((s) =>
                [
                  ...(run.workflow.skillIds || []),
                  ...(d.skillIds || []),
                ].includes(s.id),
              )
              .map((s) => s.name)
              .join(", ") || "None"
          }\n\nConnected context received from: ${Object.keys(context.parents).join(", ") || "workflow input"}.\n\nThis is a simulated agent response. In Live mode, the selected provider receives these instructions and this connected context. No model was called.`,
      };
    }
    return {
      output: await generate(
        d.provider,
        d.model,
        d.prompt || "Complete your focused task using the provided context.",
        asText(context),
        signal,
        `${run.id}-${node.id}`,
        (run.skillSnapshots || []).filter((s) =>
          [...(run.workflow.skillIds || []), ...(d.skillIds || [])].includes(
            s.id,
          ),
        ),
      ),
    };
  }
  if (d.kind === "browser") {
    if (run.mode === "demo")
      return {
        output: {
          simulated: true,
          type: "browser",
          summary: "Demo: no browser was opened and no website was contacted.",
          url: d.url,
          needsReview: false,
        },
      };
    const state = run.nodes[node.id];
    const previousResult = state.output as { url?: string } | undefined;
    return runBrowserTask(
      state.humanResponse && previousResult?.url
        ? { ...d, url: previousResult.url }
        : d,
      state.humanResponse
        ? {
            ...context,
            humanResponse: state.humanResponse,
            previousBrowserResult: state.output,
          }
        : context,
      signal,
      `${run.id}-${node.id}`,
      `${run.workflowId}-${node.id}`,
      (run.skillSnapshots || []).filter((s) =>
        [...run.workflow.skillIds, ...d.skillIds].includes(s.id),
      ),
      (message) =>
        run.events.push({
          time: new Date().toISOString(),
          nodeId: node.id,
          message,
        }),
    );
  }
  if (d.kind === "action") {
    if (run.mode === "demo")
      return {
        output: {
          simulated: true,
          method: d.method,
          url: d.url || "(no URL configured)",
          message: "Demo: no HTTP request was sent.",
          context: context.previous,
        },
      };
    return executeHttpAction(d, context, signal, (message) =>
      run.events.push({
        time: new Date().toISOString(),
        nodeId: node.id,
        message,
      }),
    );
  }
  throw new Error("Unsupported node kind.");
}
export function resumeRun(previous: Run, id: string): Run {
  if (!["failed", "cancelled"].includes(previous.status))
    throw new Error("Only stopped or failed runs can be resumed.");
  const run = createRun(structuredClone(previous.workflow), previous.mode, id);
  const inputNode = previous.workflow.nodes.find(
    (n) => n.data.kind === "input",
  );
  run.input =
    previous.input ??
    (inputNode ? previous.nodes[inputNode.id]?.output : undefined);
  if (run.input === undefined) {
    try {
      run.input = JSON.parse(previous.workflow.input);
    } catch {
      throw new Error("The original run input is unavailable.");
    }
  }
  run.skillSnapshots = structuredClone(previous.skillSnapshots);
  run.workflowSnapshots = structuredClone(previous.workflowSnapshots);
  run.resumedFrom = previous.id;
  run.concurrency = previous.concurrency;
  for (const [nodeId, result] of Object.entries(previous.nodes))
    if (result.status === "completed" || result.status === "skipped")
      run.nodes[nodeId] = {
        ...structuredClone(result),
        reusedFrom: previous.id,
      };
  return run;
}
export function uncertainActions(run: Run): string[] {
  const containsPost = (id: string, seen = new Set<string>()): boolean => {
    if (seen.has(id)) return false;
    seen.add(id);
    const child =
      run.workflowSnapshots && Object.hasOwn(run.workflowSnapshots, id)
        ? run.workflowSnapshots[id]
        : undefined;
    return !!child?.nodes.some(
      (n) =>
        (n.data.kind === "action" && n.data.method === "POST") ||
        (n.data.kind === "browser" && n.data.browserMode === "interact") ||
        (n.data.kind === "workflow" && containsPost(n.data.workflowId, seen)),
    );
  };
  return run.workflow.nodes
    .filter(
      (n) =>
        run.nodes[n.id]?.startedAt &&
        ["failed", "cancelled"].includes(run.nodes[n.id].status) &&
        ((n.data.kind === "action" && n.data.method === "POST") ||
          (n.data.kind === "browser" && n.data.browserMode === "interact") ||
          (n.data.kind === "workflow" && containsPost(n.data.workflowId))),
    )
    .map(
      (n) =>
        `${n.data.label}${n.data.kind === "workflow" ? " (nested external actions)" : ""}`,
    );
}

export async function executeRun(
  run: Run,
  input: unknown,
  signal: AbortSignal,
  stack: string[] = [run.workflowId],
  persist: (run: Run) => Promise<void> = (r) => saveJson("runs", r.id, r),
): Promise<void> {
  // A worker retry must never skip a durable human gate.
  if (Object.values(run.nodes).some((state) => state.status === "waiting"))
    return;
  run.input = input;
  const concurrency = Math.max(
    1,
    Math.min(8, Math.floor(run.concurrency || 3)),
  );
  run.concurrency = concurrency;
  const emit = (message: string, nodeId?: string) =>
    run.events.push({ time: new Date().toISOString(), nodeId, message });
  // Serialize immutable snapshots so slower writes cannot overwrite newer state.
  let writes: Promise<void> = Promise.resolve();
  const checkpoint = () => {
    const snapshot = structuredClone(run);
    writes = writes.then(() => persist(snapshot));
    return writes;
  };
  const stop = new AbortController();
  const executionSignal = AbortSignal.any([signal, stop.signal]);
  let firstError: unknown;
  try {
    await prepareRun(run);
    const errors = validateGraph(run.workflow);
    if (errors.length) throw new Error(errors.join(" "));
    emit(
      `${run.mode === "demo" ? "Demo" : "Live"} run ${run.events.length ? "continued from saved progress" : run.resumedFrom ? "resumed from checkpoint" : "started"}`,
    );
    await checkpoint();
    const pending = new Set(
      run.workflow.nodes
        .filter((n) => run.nodes[n.id].status === "pending")
        .map((n) => n.id),
    );
    while (pending.size) {
      executionSignal.throwIfAborted();
      const ready = run.workflow.nodes
        .filter(
          (node) =>
            pending.has(node.id) &&
            !run.workflow.edges.some(
              (e) => e.target === node.id && pending.has(e.source),
            ),
        )
        .slice(0, concurrency);
      if (!ready.length)
        throw new Error("No runnable nodes. Check for cycles.");
      // Remove only after choosing the whole batch; no child can run before its parent settles.
      ready.forEach((node) => pending.delete(node.id));
      await Promise.allSettled(
        ready.map(async (node) => {
          const state = run.nodes[node.id];
          try {
            executionSignal.throwIfAborted();
            const incoming = run.workflow.edges.filter(
              (e) => e.target === node.id,
            );
            const active = incoming.filter(
              (e) =>
                run.nodes[e.source].status === "completed" &&
                (!e.sourceHandle ||
                  (run.nodes[e.source].output as { route?: string })?.route ===
                    e.sourceHandle),
            );
            if (incoming.length && !active.length) {
              state.status = "skipped";
              emit(`${node.data.label} skipped`, node.id);
              await checkpoint();
              return;
            }
            state.status = "running";
            state.startedAt = new Date().toISOString();
            emit(`${node.data.label} started`, node.id);
            await checkpoint();
            if (node.data.kind === "user-input") {
              state.status = "waiting";
              state.requestId = randomUUID();
              // Keep a durable request; no worker or timeout waits for a person.
              const source =
                input && typeof input === "object" && !Array.isArray(input)
                  ? (input as Record<string, unknown>)
                  : {};
              state.inputDraft = Object.fromEntries(
                node.data.inputFields
                  .filter((f) => Object.hasOwn(source, f.key))
                  .map((f) => [f.key, source[f.key]]),
              );
              emit(`${node.data.label} is waiting for your input`, node.id);
              await checkpoint();
              return;
            }
            if (run.mode === "demo")
              await delay(350, undefined, { signal: executionSignal });
            const parents = Object.fromEntries(
              active.map((e) => [e.source, run.nodes[e.source].output]),
            );
            const previous =
              active.length === 1 ? parents[active[0].source] : parents;
            const result = await executeNode(
              node,
              { input, parents, previous },
              run,
              AbortSignal.any([
                executionSignal,
                AbortSignal.timeout(
                  node.data.kind === "browser"
                    ? Math.min(
                        600000,
                        Math.max(180000, (node.data.browserSteps + 3) * 20000),
                      )
                    : 180000,
                ),
              ]),
              stack,
            );
            executionSignal.throwIfAborted();
            Object.assign(state, result, {
              status: "completed",
              finishedAt: new Date().toISOString(),
              durationMs: Date.now() - Date.parse(state.startedAt!),
            });
            if (
              node.data.kind === "browser" &&
              (result.output as { needsReview?: boolean })?.needsReview === true
            ) {
              state.status = "waiting";
              state.requestId = randomUUID();
              state.inputDraft = {};
              delete state.finishedAt;
              emit(`${node.data.label} is waiting for your action`, node.id);
            } else {
              emit(`${node.data.label} completed`, node.id);
            }
            await checkpoint();
          } catch (error) {
            if (error instanceof BrowserTaskError) {
              state.artifact = error.artifact;
              state.browserUrl = error.browserUrl;
            }
            state.status = executionSignal.aborted ? "cancelled" : "failed";
            state.error =
              error instanceof Error ? error.message : String(error);
            state.finishedAt = new Date().toISOString();
            if (state.startedAt)
              state.durationMs = Date.now() - Date.parse(state.startedAt);
            if (firstError === undefined) firstError = error;
            stop.abort();
          }
        }),
      );
      if (firstError !== undefined) throw firstError;
      executionSignal.throwIfAborted();
      if (Object.values(run.nodes).some((n) => n.status === "waiting")) {
        run.status = "waiting";
        delete run.finishedAt;
        emit("Waiting for your input. Completed work is saved.");
        await checkpoint();
        return;
      }
    }
    run.status = "completed";
    emit("Run completed");
  } catch (error) {
    run.status = signal.aborted ? "cancelled" : "failed";
    run.error = signal.aborted
      ? "Run cancelled."
      : error instanceof Error
        ? error.message
        : String(error);
    emit(run.error);
    for (const state of Object.values(run.nodes))
      if (["pending", "running", "waiting"].includes(state.status))
        state.status = "cancelled";
  }
  run.finishedAt = new Date().toISOString();
  await checkpoint();
}

export function answerInput(
  run: Run,
  nodeId: string,
  requestId: string,
  values: unknown,
) {
  const node = run.workflow.nodes.find(
    (n) => n.id === nodeId && ["user-input", "browser"].includes(n.data.kind),
  );
  const state = run.nodes[nodeId];
  if (
    run.status !== "waiting" ||
    !node ||
    state?.status !== "waiting" ||
    state.requestId !== requestId
  )
    throw new Error(
      "This input request is no longer waiting. Refresh the run to see its current state.",
    );
  const result = validateAnswers(
    node.data.kind === "browser" ? browserReviewFields : node.data.inputFields,
    values,
  );
  if (Object.keys(result.errors).length) return result;
  state.status = "completed";
  if (node.data.kind === "browser") {
    state.humanResponse = result.answers;
    if (result.answers.action === "Continue browser task") {
      state.status = "pending";
    } else {
      state.output = {
        ...(state.output as Record<string, unknown>),
        needsReview: false,
        reviewedByUser: true,
      };
    }
  } else {
    state.output = result.answers;
  }
  state.finishedAt = new Date().toISOString();
  delete state.inputDraft;
  delete state.requestId;
  run.events.push({
    time: state.finishedAt,
    nodeId,
    message: `${node.data.label}: answers received`,
  });
  return result;
}
