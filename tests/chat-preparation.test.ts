import { afterEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import * as providers from "../server/providers";
import { planChat } from "../server/chat";
import { saveJson } from "../server/storage";
import { blank } from "../shared/templates";

afterEach(() => vi.restoreAllMocks());

it.each([true, false])(
  "prepares structured task input with the live model even when workflow selection is already known (explicit=%s)",
  async (explicit) => {
    const workflow = {
      ...blank,
      id: randomUUID(),
      name: `Triage ${randomUUID()}`,
      input: JSON.stringify({
        title: "Checkout outage",
        impact: "All customers blocked",
      }),
    };
    await saveJson("workflows", workflow.id, workflow);
    vi.spyOn(providers, "capabilities").mockReturnValue({
      ...providers.capabilities(),
      local: true,
    });
    const nextInput = { title: "Tooltip typo", impact: "Nobody blocked" };
    const generate = vi
      .spyOn(providers, "generate")
      .mockResolvedValue(
        JSON.stringify({
          message: "Prepared typo report",
          workflowId: workflow.id,
          input: nextInput,
        }),
      );
    const chat = await planChat(
      {
        id: randomUUID(),
        mode: "live",
        provider: "local",
        message: `Run ${workflow.name}: a tooltip has a typo. Nobody is blocked.`,
        ...(explicit ? { workflowId: workflow.id } : {}),
      },
      new AbortController().signal,
    );
    expect(generate).toHaveBeenCalledOnce();
    expect(chat.plan?.source).toBe("model");
    expect(chat.plan?.input).toEqual(nextInput);
    expect(chat.runIds).toEqual([]);
  },
);

it("preserves explicit JSON exactly without a model rewriting it", async () => {
  await saveJson("workflows", blank.id, blank);
  const generate = vi.spyOn(providers, "generate");
  const input = { title: "Tooltip typo", impact: "Nobody blocked" };
  const chat = await planChat(
    {
      id: randomUUID(),
      mode: "live",
      provider: "local",
      workflowId: blank.id,
      message: JSON.stringify(input),
    },
    new AbortController().signal,
  );
  expect(chat.plan?.input).toEqual(input);
  expect(generate).not.toHaveBeenCalled();
});

it("rejects a model switching away from the user's selected workflow", async () => {
  await saveJson("workflows", blank.id, blank);
  vi.spyOn(providers, "capabilities").mockReturnValue({
    ...providers.capabilities(),
    local: true,
  });
  vi.spyOn(providers, "generate").mockResolvedValue(
    JSON.stringify({
      message: "Changed",
      workflowId: "different-workflow",
      input: {},
    }),
  );
  await expect(
    planChat(
      {
        id: randomUUID(),
        mode: "live",
        provider: "local",
        workflowId: blank.id,
        message: "Summarize these notes",
      },
      new AbortController().signal,
    ),
  ).rejects.toThrow("changed the selected workflow");
});
