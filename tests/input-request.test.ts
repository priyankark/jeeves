import { it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  createRun,
  executeRun,
  answerInput,
  resumeRun,
} from "../server/engine";
import { initialize, readJson, saveJson } from "../server/storage";
import {
  makeNode,
  validateGraph,
  type Workflow,
  type Run,
} from "../shared/schema";
import {
  inputFieldSchema,
  shoppingInputFields,
  validateAnswers,
} from "../shared/input-request";
const workflow = (): Workflow => ({
  id: randomUUID(),
  name: "Collect shopping details",
  description: "",
  skillIds: [],
  input: "{}",
  nodes: [
    makeNode("input", "input", 0, 0),
    makeNode("handoff", "before", 320, 0),
    makeNode("user-input", "ask", 640, 0, { inputFields: shoppingInputFields }),
    makeNode("output", "output", 960, 0),
  ],
  edges: [
    { id: "a", source: "input", target: "before" },
    { id: "b", source: "before", target: "ask" },
    { id: "c", source: "ask", target: "output" },
  ],
});
const good = {
  grocery_list: [" 2 oat milk ", ""],
  budget_usd: 35,
  delivery_zip: "02139",
  dietary_constraints: [],
  substitutions: false,
};
it("pauses durably, survives restart, and continues the same run without replaying completed steps", async () => {
  const run = createRun(workflow(), "live", randomUUID());
  await executeRun(run, {}, new AbortController().signal);
  expect(run.status).toBe("waiting");
  expect(run.finishedAt).toBeUndefined();
  expect(run.nodes.output.status).toBe("pending");
  const artifact = structuredClone(run.nodes.before);
  await initialize();
  const recovered = await readJson<Run>("runs", run.id);
  expect(recovered.status).toBe("waiting");
  expect(() => resumeRun(recovered, randomUUID())).toThrow("Only stopped");
  const invalid = answerInput(
    recovered,
    "ask",
    recovered.nodes.ask.requestId!,
    { ...good, budget_usd: 0, delivery_zip: "bad" },
  );
  expect(Object.keys(invalid.errors)).toEqual(["budget_usd", "delivery_zip"]);
  expect(recovered.nodes.ask.status).toBe("waiting");
  const answered = answerInput(
    recovered,
    "ask",
    recovered.nodes.ask.requestId!,
    good,
  );
  expect(answered.errors).toEqual({});
  recovered.status = "running";
  await executeRun(recovered, recovered.input, new AbortController().signal);
  expect(recovered.status).toBe("completed");
  expect(recovered.id).toBe(run.id);
  expect(recovered.nodes.before).toEqual(artifact);
  expect(recovered.nodes.output.output).toEqual({
    ...good,
    grocery_list: ["2 oat milk"],
  });
  expect(
    recovered.events.filter(
      (e) => e.nodeId === "before" && e.message.endsWith("started"),
    ),
  ).toHaveLength(1);
  expect(() =>
    answerInput(recovered, "ask", run.nodes.ask.requestId!, good),
  ).toThrow("no longer waiting");
});
it("requires every parallel request before executing their descendants", async () => {
  const w = workflow();
  w.nodes = [
    makeNode("input", "input", 0, 0),
    makeNode("user-input", "a", 300, 0),
    makeNode("user-input", "b", 300, 200),
    makeNode("output", "output", 650, 0),
  ];
  w.edges = [
    { id: "a", source: "input", target: "a" },
    { id: "b", source: "input", target: "b" },
    { id: "c", source: "a", target: "output" },
    { id: "d", source: "b", target: "output" },
  ];
  const run = createRun(w, "live", randomUUID());
  await executeRun(run, {}, new AbortController().signal);
  expect(run.nodes.a.status).toBe("waiting");
  expect(run.nodes.b.status).toBe("waiting");
  answerInput(run, "a", run.nodes.a.requestId!, { answer: "first" });
  expect(run.nodes.output.status).toBe("pending");
  answerInput(run, "b", run.nodes.b.requestId!, { answer: "second" });
  run.status = "running";
  await executeRun(run, {}, new AbortController().signal);
  expect(run.nodes.output.output).toEqual({
    a: { answer: "first" },
    b: { answer: "second" },
  });
});
it("does not request input on an unselected branch", async () => {
  const w = workflow();
  w.nodes.splice(
    1,
    1,
    makeNode("decision", "before", 320, 0, {
      decisionEngine: "rule",
      field: "input.approved",
      value: "true",
    }),
  );
  w.edges[1].sourceHandle = "pass";
  w.edges.push({
    id: "no",
    source: "before",
    sourceHandle: "fail",
    target: "output",
  });
  const run = createRun(w, "live", randomUUID());
  await executeRun(run, { approved: false }, new AbortController().signal);
  expect(run.status).toBe("completed");
  expect(run.nodes.ask.status).toBe("skipped");
});
it("validates typed answers, treats false and zero correctly, and discards undeclared fields", () => {
  const fields = [
    inputFieldSchema.parse({
      key: "n",
      label: "Count",
      type: "number",
      min: 0,
    }),
    inputFieldSchema.parse({ key: "yes", label: "Agree", type: "boolean" }),
    inputFieldSchema.parse({
      key: "choice",
      label: "Choice",
      type: "choice",
      options: ["A", "B"],
    }),
  ];
  expect(
    validateAnswers(fields, {
      n: 0,
      yes: false,
      choice: "A",
      hidden: "ignore",
    }),
  ).toEqual({ answers: { n: 0, yes: false, choice: "A" }, errors: {} });
  expect(
    Object.keys(
      validateAnswers(fields, { n: "12", yes: "false", choice: "C" }).errors,
    ),
  ).toHaveLength(3);
  const w = workflow();
  w.nodes[2].data.inputFields = [
    ...shoppingInputFields,
    shoppingInputFields[0],
  ];
  expect(validateGraph(w).join()).toContain("unique key");
  expect(
    inputFieldSchema.safeParse({ key: "constructor", label: "Bad" }).success,
  ).toBe(false);
});
