import { afterEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { weeklyUpdate, weeklyUpdateInput } from "../shared/first-workflow";
import { createRun, executeRun } from "../server/engine";
import { applyChatConnection, planChat, readChat } from "../server/chat";
import * as providers from "../server/providers";
import { makeNode } from "../shared/schema";
import { saveJson } from "../server/storage";

afterEach(() => vi.restoreAllMocks());
const signal = () => new AbortController().signal;

it("runs the complete example without AI and labels copied sample output", async () => {
  const generate = vi.spyOn(providers, "generate");
  const chat = await planChat(
    {
      id: randomUUID(),
      message: "Show me the example",
      templateId: "weekly-update",
      mode: "demo",
    },
    signal(),
  );
  expect(chat.plan?.input).toEqual(weeklyUpdateInput);
  expect(chat.runIds).toEqual([]);
  const run = createRun(chat.plan!.workflow, "demo", randomUUID());
  await executeRun(run, chat.plan!.input, signal());
  expect(run.status).toBe("completed");
  expect(run.nodes.update.output).toContain("Sample result");
  expect(run.nodes.update.output).toContain("## Blockers");
  expect(run.nodes.update.output).toContain("sandbox access");
  expect(run.nodes.update.output).not.toContain("Instructions:");
  expect(generate).not.toHaveBeenCalled();
});

it("never substitutes the canned result for changed notes or changed instructions", async () => {
  for (const change of ["notes", "prompt"]) {
    const workflow = structuredClone(weeklyUpdate);
    const input = { ...weeklyUpdateInput };
    if (change === "notes") input.notes = "A completely different project";
    else
      workflow.nodes.find((n) => n.id === "draft")!.data.prompt =
        "Write a poem instead";
    const run = createRun(workflow, "demo", randomUUID());
    await executeRun(run, input, signal());
    expect(run.status).toBe("completed");
    expect(run.nodes.update.output).not.toContain("Sample result");
    expect(run.nodes.update.output).toContain("simulated agent response");
  }
});

it("applies one connection to agent steps only, preserves input and prior run snapshots, and survives refinement", async () => {
  vi.spyOn(providers, "capabilities").mockReturnValue({
    ...providers.capabilities(),
    local: true,
  });
  const chat = await planChat(
    {
      id: randomUUID(),
      message: "Example",
      templateId: "weekly-update",
      mode: "demo",
    },
    signal(),
  );
  const original = structuredClone(chat.plan!);
  // Include non-agent steps to guard against changing their connection semantics.
  chat.plan!.workflowSnapshots[chat.plan!.workflow.id].nodes.push(
    makeNode("browser", "browser-fixture", 0, 0, { provider: "codex" }),
  );
  await saveJson("chats", chat.id, chat);
  const input = { project: "Actual project", notes: "Keep these edited notes" };
  const updated = await applyChatConnection(chat.id, {
    revision: chat.revision,
    provider: "local",
    model: "fixture-model",
    input,
  });
  expect(updated.revision).not.toBe(chat.revision);
  expect(updated.plan!.input).toEqual(input);
  expect(
    updated
      .plan!.workflow.nodes.filter((n) => n.data.kind === "agent")
      .every(
        (n) => n.data.provider === "local" && n.data.model === "fixture-model",
      ),
  ).toBe(true);
  expect(
    updated.plan!.workflow.nodes.find((n) => n.id === "browser-fixture")!.data
      .provider,
  ).toBe("codex");
  expect(
    original.workflow.nodes.find((n) => n.id === "draft")!.data.provider,
  ).toBe("openai");
  await expect(
    applyChatConnection(chat.id, {
      revision: chat.revision,
      provider: "local",
      input,
    }),
  ).rejects.toThrow("proposal changed");
  const refined = await planChat(
    {
      id: chat.id,
      message: "Keep it brief",
      mode: "demo",
      proposedInput: input,
    },
    signal(),
  );
  expect(
    refined.plan!.workflow.nodes.find((n) => n.id === "draft")!.data.provider,
  ).toBe("local");
  expect(refined.plan!.input).toMatchObject(input);
  expect(
    (await readChat(chat.id)).plan!.workflow.nodes.find(
      (n) => n.id === "draft",
    )!.data.model,
  ).toBe("fixture-model");
  const generate = vi.spyOn(providers, "generate").mockResolvedValue(
    JSON.stringify({
      message: "Prepared the shorter update",
      workflowId: refined.plan!.workflow.id,
      input: { ...input, task: "Keep it brief" },
    }),
  );
  const live = await planChat(
    {
      id: chat.id,
      message: "Keep it brief",
      mode: "live",
      provider: "local",
      proposedInput: input,
    },
    signal(),
  );
  expect(generate).toHaveBeenCalledOnce();
  expect(
    live.plan!.workflow.nodes.find((n) => n.id === "draft")!.data.provider,
  ).toBe("local");
  expect(
    live.plan!.workflowSnapshots[live.plan!.workflow.id].nodes.find(
      (n) => n.id === "draft",
    )!.data.provider,
  ).toBe("local");
});

it("starts the own-notes draft without retaining sample notes or calling AI", async () => {
  const generate = vi.spyOn(providers, "generate");
  const chat = await planChat(
    {
      id: randomUUID(),
      message: "Example",
      templateId: "weekly-update",
      mode: "demo",
    },
    signal(),
  );
  const next = await planChat(
    {
      id: chat.id,
      message: "Use my notes",
      taskInput: { project: "", notes: "" },
      intent: "new",
      mode: "live",
    },
    signal(),
  );
  expect(next.plan!.workflow.id).toBe(chat.plan!.workflow.id);
  expect(next.plan!.input).toEqual({ project: "", notes: "" });
  expect(generate).not.toHaveBeenCalled();
});
