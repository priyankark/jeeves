import { afterEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRun, executeRun, answerInput } from "../server/engine";
import { initialize, readJson } from "../server/storage";
import { workflowSchema, type Run } from "../shared/schema";
import { groceryCart } from "../shared/templates";
import * as browser from "../server/browser";

afterEach(() => vi.restoreAllMocks());
const answers = {
  grocery_list: ["2 cartons oat milk"],
  budget_usd: 25,
  delivery_zip: "02139",
  dietary_constraints: [],
  substitutions: false,
};
const execute = (run: Run) =>
  executeRun(
    run,
    run.input ?? JSON.parse(run.workflow.input),
    new AbortController().signal,
  );
const review = {
  output: {
    type: "browser",
    needsReview: true,
    summary: "Sign in before shopping.",
    url: "https://www.amazon.com/cart",
    actions: [],
    screenshot: "review.png",
  },
  artifact: "review.png",
};

it.each([
  ["built-in", groceryCart],
  [
    "marketplace",
    JSON.parse(
      readFileSync("marketplace/workflows/grocery-browser.json", "utf8"),
    ).workflows["grocery-browser"],
  ],
  [
    "Amazon",
    JSON.parse(
      readFileSync(
        "docs/usability-audit-2026-09-27/amazon-with-input-request.json",
        "utf8",
      ),
    ),
  ],
])(
  "%s grocery workflow cannot open a browser before valid submitted answers",
  async (_label, source) => {
    const task = vi.spyOn(browser, "runBrowserTask").mockResolvedValue(review);
    const run = createRun(workflowSchema.parse(source), "live", randomUUID());
    await execute(run);
    expect(run.status).toBe("waiting");
    expect(task).not.toHaveBeenCalled();
    const request = run.nodes["shopping-details"].requestId!;
    expect(
      answerInput(run, "shopping-details", request, {
        ...answers,
        budget_usd: 0,
      }).errors,
    ).toHaveProperty("budget_usd");
    await execute(run); // Even a worker retry must not bypass an unanswered gate.
    expect(task).not.toHaveBeenCalled();
    expect(run.nodes.output.status).toBe("pending");
    expect(
      answerInput(run, "shopping-details", request, answers).errors,
    ).toEqual({});
    run.status = "running";
    await execute(run);
    expect(task).toHaveBeenCalledTimes(1);
    expect(task.mock.calls[0][1]).toMatchObject({ previous: answers });
    expect(run.status).toBe("waiting");
    expect(run.nodes.output.status).toBe("pending");
  },
);

it("browser handoffs survive restart, require a fresh explicit action, and preserve completed work", async () => {
  const task = vi.spyOn(browser, "runBrowserTask").mockResolvedValue(review);
  let run = createRun(structuredClone(groceryCart), "live", randomUUID());
  await execute(run);
  answerInput(
    run,
    "shopping-details",
    run.nodes["shopping-details"].requestId!,
    answers,
  );
  run.status = "running";
  await execute(run);
  const originalInput = structuredClone(run.nodes.input);
  const originalAnswers = structuredClone(run.nodes["shopping-details"]);
  const requestId = run.nodes.shop.requestId!;
  await initialize();
  run = await readJson<Run>("runs", run.id);
  expect(run.status).toBe("waiting");
  expect(run.finishedAt).toBeUndefined();
  await execute(run);
  expect(task).toHaveBeenCalledTimes(1);
  expect(answerInput(run, "shop", requestId, {}).errors).toHaveProperty(
    "action",
  );
  answerInput(run, "shop", requestId, {
    action: "Continue browser task",
    notes: "I signed in.",
  });
  expect(() =>
    answerInput(run, "shop", requestId, { action: "Continue browser task" }),
  ).toThrow("no longer waiting");
  run.status = "running";
  await execute(run);
  expect(task).toHaveBeenCalledTimes(2);
  expect(task.mock.calls[1][0].url).toBe(review.output.url);
  expect(task.mock.calls[1][1]).toMatchObject({
    humanResponse: { notes: "I signed in." },
    previousBrowserResult: review.output,
  });
  expect(run.nodes.input).toEqual(originalInput);
  expect(run.nodes["shopping-details"]).toEqual(originalAnswers);
  expect(run.nodes.shop.requestId).not.toBe(requestId);
  expect(run.nodes.output.status).toBe("pending");
  answerInput(run, "shop", run.nodes.shop.requestId!, {
    action: "Accept result and finish this step",
  });
  run.status = "running";
  await execute(run);
  expect(run.status).toBe("completed");
  expect(run.nodes.output.output).toMatchObject({
    reviewedByUser: true,
    needsReview: false,
    summary: review.output.summary,
  });
  expect(task).toHaveBeenCalledTimes(2); // Accepting never performs another browser action.
});
