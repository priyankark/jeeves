import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createRun,
  executeRun,
  resumeRun,
  uncertainActions,
} from "../server/engine";
import { makeNode, type Workflow, type Run } from "../shared/schema";
import { blank } from "../shared/templates";
import { randomUUID } from "node:crypto";
const response = () =>
  new Response(
    JSON.stringify({
      status: "completed",
      output: [{ content: [{ type: "output_text", text: "completed task" }] }],
    }),
  );
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
describe("parallel scheduling and checkpoint recovery", () => {
  it("runs independent nodes concurrently and waits for all parents at a join", async () => {
    vi.stubEnv("OPENAI_API_KEY", "fake-for-test");
    let active = 0,
      maximum = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      active++;
      maximum = Math.max(maximum, active);
      await new Promise((r) => setTimeout(r, 30));
      active--;
      return response();
    });
    const graph: Workflow = {
      ...blank,
      nodes: [
        blank.nodes[0],
        makeNode("agent", "first", 0, 0),
        makeNode("agent", "second", 0, 0),
        blank.nodes[1],
      ],
      edges: [
        { id: "a", source: "input", target: "first" },
        { id: "b", source: "input", target: "second" },
        { id: "c", source: "first", target: "output" },
        { id: "d", source: "second", target: "output" },
      ],
    };
    const run = createRun(graph, "live", randomUUID());
    run.concurrency = 2;
    const snapshots: Run[] = [];
    await executeRun(
      run,
      { task: "test" },
      new AbortController().signal,
      undefined,
      async (r) => {
        await new Promise((resolve) => setTimeout(resolve, 2));
        snapshots.push(r);
      },
    );
    expect(maximum).toBe(2);
    expect(run.status).toBe("completed");
    expect(run.nodes.output.output).toEqual({
      first: "completed task",
      second: "completed task",
    });
    expect(Date.parse(run.nodes.output.startedAt!)).toBeGreaterThanOrEqual(
      Date.parse(run.nodes.second.finishedAt!),
    );
    expect(snapshots.at(-1)?.status).toBe("completed");
    expect(snapshots[0].nodes.first.status).toBe("pending");
    expect(snapshots.map((s) => s.events.length)).toEqual(
      snapshots.map((s) => s.events.length).sort((a, b) => a - b),
    );
  });
  it("resumes failed work without replaying completed provider calls", async () => {
    const graph: Workflow = {
      ...blank,
      nodes: [
        blank.nodes[0],
        makeNode("agent", "first", 0, 0),
        makeNode("agent", "second", 0, 0),
        blank.nodes[1],
      ],
      edges: [
        { id: "a", source: "input", target: "first" },
        { id: "b", source: "first", target: "second" },
        { id: "c", source: "second", target: "output" },
      ],
    };
    const previous = createRun(graph, "live", randomUUID());
    previous.status = "failed";
    previous.input = { task: "original input" };
    previous.nodes.input = { status: "completed", output: previous.input };
    previous.nodes.first = {
      status: "completed",
      output: "saved expensive result",
    };
    previous.nodes.second = { status: "failed", error: "temporary error" };
    previous.nodes.output = { status: "cancelled" };
    const resumed = resumeRun(previous, randomUUID());
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(response());
    await executeRun(
      resumed,
      resumed.input,
      new AbortController().signal,
      undefined,
      async () => {},
    );
    expect(resumed.status).toBe("completed");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(fetch.mock.calls[0][1]?.body)).toContain(
      "saved expensive result",
    );
    expect(resumed.nodes.first.reusedFrom).toBe(previous.id);
    expect(previous.nodes.second.status).toBe("failed");
  });
  it("cancels peer work when one branch fails and does not run the join", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    let calls = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      calls++;
      if (calls === 1) {
        await new Promise((r) => setTimeout(r, 20));
        return new Response("", { status: 503 });
      }
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new Error("aborted")),
          { once: true },
        );
      });
    });
    const graph: Workflow = {
      ...blank,
      nodes: [
        blank.nodes[0],
        makeNode("agent", "first", 0, 0),
        makeNode("agent", "second", 0, 0),
        blank.nodes[1],
      ],
      edges: [
        { id: "a", source: "input", target: "first" },
        { id: "b", source: "input", target: "second" },
        { id: "c", source: "first", target: "output" },
        { id: "d", source: "second", target: "output" },
      ],
    };
    const run = createRun(graph, "live", randomUUID());
    await executeRun(
      run,
      {},
      new AbortController().signal,
      undefined,
      async () => {},
    );
    expect(run.status).toBe("failed");
    expect(run.nodes.first.status).toBe("failed");
    expect(run.nodes.second.status).toBe("cancelled");
    expect(run.nodes.output.status).toBe("cancelled");
  });
  it("identifies uncertain POST actions and prevents resuming completed runs", () => {
    const graph: Workflow = {
      ...blank,
      nodes: [
        ...blank.nodes,
        makeNode("action", "post", 0, 0, {
          method: "POST",
          label: "Create record",
        }),
      ],
    };
    const run = createRun(graph, "live", randomUUID());
    run.nodes.post = { status: "failed", startedAt: new Date().toISOString() };
    run.status = "failed";
    expect(uncertainActions(run)).toEqual(["Create record"]);
    run.nodes.post = { status: "cancelled" };
    expect(uncertainActions(run)).toEqual([]);
    run.status = "completed";
    expect(() => resumeRun(run, randomUUID())).toThrow("Only stopped");
  });
});

it("recognizes possibly delivered POSTs inside an interrupted nested workflow", () => {
  const child = {
    ...blank,
    id: "post-child",
    nodes: [
      ...blank.nodes,
      makeNode("action", "write", 0, 0, { method: "POST" }),
    ],
  };
  const workflow = {
    ...blank,
    nodes: [
      ...blank.nodes,
      makeNode("workflow", "nested", 0, 0, { workflowId: child.id }),
    ],
  };
  const run = createRun(workflow, "live", randomUUID());
  run.workflowSnapshots = { [child.id]: child };
  run.nodes.nested = {
    status: "cancelled",
    startedAt: new Date().toISOString(),
  };
  expect(uncertainActions(run)).toEqual([
    "Nested workflow (nested external actions)",
  ]);
});

it("requires review before replaying an interrupted browser interaction", () => {
  const browser = makeNode("browser", "browser", 0, 0, {
    browserMode: "interact",
  });
  const workflow = {
    ...blank,
    nodes: [blank.nodes[0], browser, blank.nodes[1]],
    edges: [
      { id: "a", source: "input", target: "browser" },
      { id: "b", source: "browser", target: "output" },
    ],
  };
  const run = createRun(workflow, "live", "browser-recovery");
  run.status = "failed";
  run.nodes.browser = {
    status: "cancelled",
    startedAt: new Date().toISOString(),
  };
  expect(uncertainActions(run)).toEqual(["Browser task"]);
  browser.data.browserMode = "observe";
  expect(uncertainActions(run)).toEqual([]);
});
