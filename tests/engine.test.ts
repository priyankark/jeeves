import { describe, it, expect, vi, afterEach } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createRun, executeRun, evaluate, getField } from "../server/engine";
import { dataDir, generate } from "../server/providers";
import { saveJson, readJson } from "../server/storage";
import {
  makeNode,
  validateGraph,
  workflowSchema,
  type Workflow,
  type Run,
} from "../shared/schema";
import { blank, starter } from "../shared/templates";
const noop = async () => {};
const controller = () => new AbortController();
afterEach(() => vi.restoreAllMocks());
describe("graph validation", () => {
  it("accepts the starter and rejects unreachable nodes", () => {
    expect(validateGraph(starter)).toEqual([]);
    expect(
      validateGraph({
        ...blank,
        nodes: [...blank.nodes, makeNode("agent", "lost", 0, 0)],
      }).join(),
    ).toContain("not connected");
  });
  it("rejects cycles, missing endpoints and duplicate node IDs", () => {
    expect(
      validateGraph({
        ...blank,
        edges: [
          ...blank.edges,
          { id: "back", source: "output", target: "input" },
        ],
      }).join(),
    ).toContain("Cycles");
    expect(
      validateGraph({
        ...blank,
        edges: [{ id: "missing", source: "input", target: "gone" }],
      }).join(),
    ).toContain("missing node");
    expect(
      validateGraph({
        ...blank,
        nodes: [...blank.nodes, blank.nodes[0]],
      }).join(),
    ).toContain("unique");
  });
  it("requires pass/fail handles on decisions and prevents path traversal", () => {
    const graph = structuredClone(starter);
    graph.edges.find((e) => e.source === "gate")!.sourceHandle = null;
    expect(validateGraph(graph).join()).toContain("decision port");
    expect(() => workflowSchema.parse({ ...blank, id: "../../etc" })).toThrow();
    expect(() =>
      makeNode("handoff", "handoff", 0, 0, { filename: "../bad.md" }),
    ).toThrow();
  });
});
describe("decision conditions", () => {
  const context = {
    input: { approved: false, score: 0, text: "hello world" },
    parents: {},
    previous: null,
  };
  it("handles false and zero without treating them as missing", () => {
    expect(
      evaluate(
        context,
        makeNode("decision", "gate", 0, 0, {
          field: "input.approved",
          value: "false",
        }),
      ),
    ).toBe(true);
    expect(
      evaluate(
        context,
        makeNode("decision", "gate", 0, 0, {
          field: "input.score",
          operator: "exists",
        }),
      ),
    ).toBe(true);
  });
  it("compares numbers and strings, excludes inherited properties", () => {
    expect(
      evaluate(
        context,
        makeNode("decision", "gate", 0, 0, {
          field: "input.text",
          operator: "contains",
          value: "world",
        }),
      ),
    ).toBe(true);
    expect(
      evaluate(
        context,
        makeNode("decision", "gate", 0, 0, {
          field: "input.score",
          operator: "greater_than",
          value: "-1",
        }),
      ),
    ).toBe(true);
    expect(getField(context, "input.toString")).toBeUndefined();
  });
});
function branching(): Workflow {
  return {
    ...blank,
    nodes: [
      makeNode("input", "input", 0, 0),
      makeNode("decision", "gate", 0, 0, { decisionEngine: "rule" }),
      makeNode("output", "yes", 0, 0),
      makeNode("output", "no", 0, 0),
    ],
    edges: [
      { id: "a", source: "input", target: "gate" },
      { id: "b", source: "gate", target: "yes", sourceHandle: "pass" },
      { id: "c", source: "gate", target: "no", sourceHandle: "fail" },
    ],
  };
}
describe("execution", () => {
  it.each([true, false])(
    "takes the right branch for approved=%s",
    async (approved) => {
      const run = createRun(branching(), "live", randomUUID());
      await executeRun(run, { approved }, controller().signal, undefined, noop);
      expect(run.status).toBe("completed");
      expect(run.nodes.yes.status).toBe(approved ? "completed" : "skipped");
      expect(run.nodes.no.status).toBe(approved ? "skipped" : "completed");
    },
  );
  it("joins only active branches, propagates skips, and writes handoff artifacts", async () => {
    const w = branching();
    w.nodes = w.nodes.map((n) =>
      n.data.kind === "output" ? makeNode("handoff", n.id, 0, 0) : n,
    );
    w.nodes.push(makeNode("output", "output", 0, 0));
    w.edges.push(
      { id: "d", source: "yes", target: "output" },
      { id: "e", source: "no", target: "output" },
    );
    const run = createRun(w, "live", randomUUID());
    await executeRun(
      run,
      { approved: true, task: "test" },
      controller().signal,
      undefined,
      noop,
    );
    expect(run.status).toBe("completed");
    expect(run.nodes.no.status).toBe("skipped");
    expect(run.nodes.output.output).toEqual(run.nodes.yes.output);
    const artifact = await readFile(
      path.join(dataDir, "artifacts", run.nodes.yes.artifact!),
      "utf8",
    );
    expect(artifact).toContain("test");
    expect(artifact).toContain("Connected context");
  });
  it("cancels in-flight demo work and marks remaining nodes cancelled", async () => {
    const c = controller();
    const run = createRun(blank, "demo", randomUUID());
    const promise = executeRun(run, {}, c.signal, undefined, noop);
    setTimeout(() => c.abort(), 30);
    await promise;
    expect(run.status).toBe("cancelled");
    expect(
      Object.values(run.nodes).every((n) => n.status === "cancelled"),
    ).toBe(true);
  });
  it("reports provider failures without completing downstream nodes", async () => {
    const w = {
      ...blank,
      nodes: [blank.nodes[0], makeNode("agent", "agent", 0, 0), blank.nodes[1]],
      edges: [
        { id: "a", source: "input", target: "agent" },
        { id: "b", source: "agent", target: "output" },
      ],
    };
    vi.stubEnv("OPENAI_API_KEY", "");
    const run = createRun(w, "live", randomUUID());
    await executeRun(run, {}, controller().signal, undefined, noop);
    expect(run.status).toBe("failed");
    expect(run.nodes.agent.error).toContain("not configured");
    expect(run.nodes.output.status).toBe("cancelled");
    vi.unstubAllEnvs();
  });
  it("executes nested workflows and persists child runs", async () => {
    await saveJson("workflows", "child", { ...blank, id: "child" });
    const w = {
      ...blank,
      nodes: [
        blank.nodes[0],
        makeNode("workflow", "child-node", 0, 0, { workflowId: "child" }),
        blank.nodes[1],
      ],
      edges: [
        { id: "a", source: "input", target: "child-node" },
        { id: "b", source: "child-node", target: "output" },
      ],
    };
    const run = createRun(w, "live", randomUUID());
    await executeRun(
      run,
      { task: "nested" },
      controller().signal,
      undefined,
      noop,
    );
    expect(run.status).toBe("completed");
    const output = run.nodes["child-node"].output as {
      runId: string;
      results: Record<string, unknown>;
    };
    expect(output.results.output).toMatchObject({ input: { task: "nested" } });
    expect((await readJson<Run>("runs", output.runId)).status).toBe(
      "completed",
    );
  });
  it("rejects recursive workflows", async () => {
    const w = {
      ...blank,
      nodes: [
        blank.nodes[0],
        makeNode("workflow", "loop", 0, 0, { workflowId: blank.id }),
        blank.nodes[1],
      ],
      edges: [
        { id: "a", source: "input", target: "loop" },
        { id: "b", source: "loop", target: "output" },
      ],
    };
    const run = createRun(w, "live", randomUUID());
    await executeRun(run, {}, controller().signal, undefined, noop);
    expect(run.status).toBe("failed");
    expect(run.error).toContain("Recursive");
  });
  it("does not call HTTP endpoints in demo mode, requires an allowlist in live mode", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const w = {
      ...blank,
      nodes: [
        blank.nodes[0],
        makeNode("action", "action", 0, 0, { url: "https://example.com" }),
        blank.nodes[1],
      ],
      edges: [
        { id: "a", source: "input", target: "action" },
        { id: "b", source: "action", target: "output" },
      ],
    };
    const demo = createRun(w, "demo", randomUUID());
    await executeRun(demo, {}, controller().signal, undefined, noop);
    expect(demo.status).toBe("completed");
    expect(fetch).not.toHaveBeenCalled();
    vi.stubEnv("ACTION_ALLOWED_ORIGINS", "");
    const live = createRun(w, "live", randomUUID());
    await executeRun(live, {}, controller().signal, undefined, noop);
    expect(live.error).toContain("ACTION_ALLOWED_ORIGINS");
    vi.unstubAllEnvs();
  });
  it("uses current OpenAI Responses shape and handles non-text output", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "completed",
          output: [
            { type: "reasoning" },
            { content: [{ type: "output_text", text: "A useful answer" }] },
          ],
        }),
        { status: 200 },
      ),
    );
    const text = await generate(
      "openai",
      "model-id",
      "task",
      "context",
      controller().signal,
      "test",
    );
    expect(text).toBe("A useful answer");
    expect(fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/responses",
      expect.objectContaining({
        body: expect.stringContaining('"store":false'),
      }),
    );
    vi.unstubAllEnvs();
  });
});
