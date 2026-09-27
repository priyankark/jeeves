import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { type ChatSession, type ChatPlan } from "../shared/packages";
import {
  workflowSchema,
  idSchema,
  providerSchema,
  type Workflow,
} from "../shared/schema";
import { snapshotWorkflowTree } from "./engine";
import { requirements } from "./packages";
import { generate, capabilities, dataDir } from "./providers";
import { readJson, listJson, saveJson } from "./storage";
export const chatInput = z.object({
  id: idSchema,
  message: z.string().trim().min(1).max(10000),
  mode: z.enum(["demo", "live"]),
  provider: providerSchema.default("openai"),
  model: z.string().max(120).default(""),
  workflowId: idSchema.optional(),
});
export const chatLocks = new Map<string, Promise<unknown>>();
export function chatLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const next = (chatLocks.get(id) || Promise.resolve())
    .catch(() => {})
    .then(fn);
  chatLocks.set(id, next);
  void next
    .finally(() => {
      if (chatLocks.get(id) === next) chatLocks.delete(id);
    })
    .catch(() => {});
  return next;
}
export async function readChat(id: string): Promise<ChatSession> {
  return readJson<ChatSession>("chats", id);
}
export async function deleteChat(id: string) {
  idSchema.parse(id);
  await unlink(path.join(dataDir, "chats", `${id}.json`));
}
function words(s: string): string[] {
  return s.toLowerCase().match(/[a-z0-9]+/g) || [];
}
export function matchWorkflows(message: string, workflows: Workflow[]) {
  const lower = message.toLowerCase();
  return workflows
    .map((w) => ({
      workflow: w,
      score: lower.includes(w.name.toLowerCase())
        ? 100
        : [...new Set(words(w.name + " " + w.description))].filter(
            (word) => word.length > 3 && words(message).includes(word),
          ).length,
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
}
export async function planChat(
  raw: unknown,
  signal: AbortSignal,
): Promise<ChatSession> {
  const body = chatInput.parse(raw);
  let session: ChatSession;
  try {
    session = await readChat(body.id);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    session = {
      id: body.id,
      title: body.message.slice(0, 70),
      updatedAt: new Date().toISOString(),
      messages: [],
      revision: randomUUID(),
      runIds: [],
      mode: body.mode,
    };
  }
  const workflows = (await listJson<Workflow>("workflows")).map((w) =>
    workflowSchema.parse(w),
  );
  const matches = matchWorkflows(body.message, workflows);
  const uniqueMatch =
    matches.length > 0 &&
    (matches.length === 1 || matches[0].score > matches[1].score);
  let chosen = body.workflowId
    ? workflows.find((w) => w.id === body.workflowId)
    : uniqueMatch
      ? matches[0].workflow
      : matches.length === 0
        ? session.plan?.workflow
        : undefined;
  if (body.workflowId && !chosen)
    throw new Error("That workflow is no longer in your library.");
  if (
    !chosen &&
    matches.length &&
    (matches.length === 1 || matches[0].score > matches[1].score)
  )
    chosen = matches[0].workflow;
  let input: unknown;
  let explicitInput: unknown;
  let hasExplicitInput = false;
  try {
    explicitInput = JSON.parse(body.message);
    hasExplicitInput = true;
  } catch {}
  let source: "local" | "model" = "local",
    reply = "";
  const history = [
    ...session.messages.slice(-12),
    {
      role: "user" as const,
      text: body.message,
      time: new Date().toISOString(),
    },
  ];
  if (
    body.mode === "live" &&
    capabilities()[body.provider] &&
    !(chosen && hasExplicitInput)
  ) {
    const result = await generate(
      body.provider,
      body.model,
      `You are Jeeves, a local workflow assistant. Help the user select and prepare one saved workflow for their task. You cannot execute workflows, send messages, or claim work completed. Return only JSON {"message":string,"workflowId":string|null,"input":unknown}. If essential information is missing, ask one useful question with workflowId null. Choose only supplied IDs. ${body.workflowId ? `The user explicitly selected ${body.workflowId}; use that workflow or ask a question, never switch workflows.` : ""} Map the latest request into the workflow's input fields. Saved workflow input is an EXAMPLE and structural guide, not facts about the new task. Replace conflicting example titles, reports, notes, reproduction steps, impact, and similar task content; do not merely append a task field while retaining an unrelated example. Preserve configuration such as repository, website, limits, and filters unless changed by the user. Do not invent missing facts: use unknown/empty values or ask. If the user explicitly asks to run the saved example, use it. Only preserve prior proposed task data when refining the SAME task; a new case replaces the old case. Selected workflow: ${chosen ? JSON.stringify(chosen) : "none"}. Previous proposed input: ${JSON.stringify(session.plan?.input)}. Available workflows: ${JSON.stringify(workflows.map((w) => ({ id: w.id, name: w.name, description: w.description, input: w.input })))}.`,
      JSON.stringify(history),
      signal,
      `home-${randomUUID()}`,
    );
    const plan = z
      .object({
        message: z.string().max(10000),
        workflowId: z.string().nullable(),
        input: z.unknown(),
      })
      .parse(
        JSON.parse(
          result
            .trim()
            .replace(/^```(?:json)?\s*/, "")
            .replace(/\s*```$/, ""),
        ),
      );
    if (plan.workflowId) {
      if (body.workflowId && plan.workflowId !== body.workflowId)
        throw new Error(
          "Assistant changed the selected workflow. Please try again.",
        );
      chosen = workflows.find((w) => w.id === plan.workflowId);
      if (!chosen)
        throw new Error(
          "Assistant proposed an unknown workflow. Select one from your library.",
        );
      input = plan.input;
    } else chosen = undefined;
    reply = plan.message;
    source = "model";
  } else if (chosen) {
    let base: unknown;
    try {
      base =
        session.plan?.workflow.id === chosen.id
          ? session.plan.input
          : JSON.parse(chosen.input);
    } catch {
      base = {};
    }
    if (hasExplicitInput) input = explicitInput;
    else {
      input = {
        ...(base && typeof base === "object" && !Array.isArray(base)
          ? base
          : {}),
        task: body.message,
      };
    }
    reply = `I've prepared “${chosen.name}”. Review the input below, then start ${body.mode === "live" ? "the live run" : "a demo"}.`;
    if (!hasExplicitInput)
      reply +=
        " Local preparation keeps saved input fields; replace any example data that does not apply to this task.";
  } else
    reply = matches.length
      ? `A few workflows could fit: ${matches
          .slice(0, 3)
          .map((x) => x.workflow.name)
          .join(", ")}. Select the one you want below.`
      : "Choose a workflow below, or describe a task using its name. You can also build a new workflow in the editor or install one from Explore.";
  let plan: ChatPlan | undefined;
  if (chosen) {
    const snapshots = await snapshotWorkflowTree(chosen);
    plan = {
      workflow: chosen,
      workflowSnapshots: snapshots,
      input,
      requirements: requirements(snapshots),
      source,
    };
  }
  signal.throwIfAborted();
  session = {
    ...session,
    mode: body.mode,
    plan,
    revision: randomUUID(),
    updatedAt: new Date().toISOString(),
    messages: [
      ...history,
      {
        role: "assistant" as const,
        text: reply,
        time: new Date().toISOString(),
      },
    ].slice(-100),
  };
  await saveJson("chats", session.id, session);
  return session;
}
