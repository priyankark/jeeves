import * as providers from "../server/providers";
afterEach(() => vi.restoreAllMocks());
import { afterEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { requestTriage } from "../shared/triage-workflow";
import { validateGraph } from "../shared/schema";
import { answerInput, createRun, executeRun } from "../server/engine";

it.each(["urgent", "routine"])(
  "Jev runs only the %s specialist",
  async (choice) => {
    expect(validateGraph(requestTriage)).toEqual([]);
    const run = createRun(structuredClone(requestTriage), "demo", randomUUID());
    await executeRun(
      run,
      { request: "Synthetic test", demo_jev_value: choice },
      new AbortController().signal,
    );
    expect(run.status).toBe("completed");
    expect(run.nodes[choice].status).toBe("completed");
    expect(run.nodes[choice === "urgent" ? "routine" : "urgent"].status).toBe(
      "skipped",
    );
    expect(run.nodes.clarify.status).toBe("skipped");
  },
);
it.each(["needs_information", "low-confidence"])(
  "%s waits durably and uses the user's answer",
  async (route) => {
    const workflow = structuredClone(requestTriage);
    if (route === "low-confidence")
      workflow.nodes.find((n) => n.id === "triage")!.data.demoConfidence = 0.2;
    const run = createRun(workflow, "demo", randomUUID());
    const input = {
      request: "Something is wrong",
      demo_jev_value: route === "low-confidence" ? "urgent" : route,
    };
    await executeRun(run, input, new AbortController().signal);
    expect(run.status).toBe("waiting");
    expect(run.nodes.followup.status).toBe("pending");
    expect(run.nodes.output.status).toBe("pending");
    const saved = JSON.parse(JSON.stringify(run));
    expect(
      answerInput(saved, "clarify", saved.nodes.clarify.requestId, {
        details: "The settings tooltip has a typo. No one is blocked.",
      }).errors,
    ).toEqual({});
    saved.status = "running";
    saved.mode = "live";
    const generate = vi
      .spyOn(providers, "generate")
      .mockResolvedValue("A response using your clarification.");
    await executeRun(saved, input, new AbortController().signal);
    expect(saved.status).toBe("completed");
    expect(saved.nodes.followup.status).toBe("completed");
    expect(generate.mock.calls[0][3]).toContain("settings tooltip");
  },
);
