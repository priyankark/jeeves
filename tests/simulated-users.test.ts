import {
  beforeAll,
  afterAll,
  afterEach,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { simulationServer } from "./fixtures/simulation-server";
import { makeNode, type Workflow } from "../shared/schema";
import { blank } from "../shared/templates";
import { createRun, executeRun } from "../server/engine";
import { runBrowserTask, type BrowserObservation } from "../server/browser";
import {
  saveIntegrations,
  actionToken,
  integrationStatus,
} from "../server/integrations";
import { dataDir } from "../server/providers";
import { matchWorkflows, planChat } from "../server/chat";
import { saveJson } from "../server/storage";
import { actionBody, interpolate } from "../server/action-context";
let fixture: Awaited<ReturnType<typeof simulationServer>>;
beforeAll(async () => {
  fixture = await simulationServer();
  await saveIntegrations({
    origins: [fixture.origin],
    secret: {
      name: "GITHUB_TOKEN",
      origin: fixture.origin,
      value: "fixture-maintainer-token",
    },
  });
});
afterAll(async () => fixture.close());
afterEach(() => vi.restoreAllMocks());
function actionWorkflow(overrides: Record<string, unknown>): Workflow {
  return {
    ...blank,
    id: randomUUID(),
    nodes: [
      makeNode("input", "input", 0, 0),
      makeNode("action", "request", 300, 0, overrides),
      makeNode("output", "output", 600, 0),
    ],
    edges: [
      { id: "a", source: "input", target: "request" },
      { id: "b", source: "request", target: "output" },
    ],
  };
}
function browserData(overrides: Record<string, unknown> = {}) {
  return makeNode("browser", "browser", 0, 0, {
    url: fixture.origin + "/shop",
    browserMode: "interact",
    ...overrides,
  }).data;
}
const click = (o: BrowserObservation, name: string) => ({
  action: "click",
  target: o.controls.find((c) => c.name === name)!.id,
});
const task = () => randomUUID();
describe("simulated user journeys", () => {
  it("private repository maintainer fetches authenticated issues with templated repository input", async () => {
    const w = actionWorkflow({
      url: fixture.origin + "/repos/{{input.owner}}/{{input.repo}}/issues",
      authEnv: "GITHUB_TOKEN",
    });
    const run = createRun(w, "live", task());
    await executeRun(
      run,
      { owner: "acme", repo: "project" },
      new AbortController().signal,
    );
    expect(run.status).toBe("completed");
    expect(run.nodes.output.output).toHaveLength(2);
    expect(JSON.stringify(run)).not.toContain("fixture-maintainer-token");
    expect(JSON.stringify(integrationStatus())).not.toContain(
      "fixture-maintainer-token",
    );
  });
  it("maintainer with expired credentials receives a next step, not just HTTP 401", async () => {
    const run = createRun(
      actionWorkflow({ url: fixture.origin + "/repos/acme/project/issues" }),
      "live",
      task(),
    );
    await executeRun(run, {}, new AbortController().signal);
    expect(run.error).toContain("Check the credential");
  });
  it("rate-limited maintainer sees the provider retry interval", async () => {
    const run = createRun(
      actionWorkflow({ url: fixture.origin + "/rate-limit" }),
      "live",
      task(),
    );
    await executeRun(run, {}, new AbortController().signal);
    expect(run.error).toContain("Retry after 60");
  });
  it("credential names cannot redirect saved secrets to another origin", () => {
    expect(() =>
      actionToken("GITHUB_TOKEN", "https://elsewhere.example"),
    ).toThrow("scoped");
  });
  it("maintainer input quotes and path characters cannot corrupt JSON or URL parameters", () => {
    expect(
      JSON.parse(
        actionBody('{"title":"{{input.title}}","count":"{{input.count}}"}', {
          input: { title: 'a "quoted" title', count: 0 },
        }),
      ),
    ).toEqual({ title: 'a "quoted" title', count: 0 });
    expect(
      interpolate(
        "https://example.com/{{input.repo}}",
        { input: { repo: "a/b?token=wrong" } },
        true,
      ),
    ).toBe("https://example.com/a%2Fb%3Ftoken%3Dwrong");
  });
  it("user with duplicated workflow names must select a copy instead of silently running the first", async () => {
    const name = "Persona duplicate maintenance";
    for (const id of ["persona-copy-a", "persona-copy-b"])
      await saveJson("workflows", id, { ...blank, id, name });
    const chat = await planChat(
      { id: task(), message: `Run ${name}`, mode: "demo" },
      new AbortController().signal,
    );
    expect(chat.plan).toBeUndefined();
    expect(chat.messages.at(-1)?.text).toContain("Select");
  });
  it("repeated marketing words do not outrank a more relevant workflow", () => {
    const a = {
      ...blank,
      id: "spam",
      name: "Notes",
      description: "github github github github",
    };
    const b = {
      ...blank,
      id: "fit",
      name: "Maintenance",
      description: "github issues",
    };
    expect(matchWorkflows("github issues", [a, b])[0].workflow.id).toBe("fit");
  });
  it("budget-conscious shopper prepares a nut-free cart and stops before checkout", async () => {
    const before = fixture.events.length;
    let step = 0;
    const result = await runBrowserTask(
      browserData(),
      { input: { budget: 15, allergy: "nuts" } },
      new AbortController().signal,
      task(),
      task(),
      [],
      () => {},
      async (o) => {
        if (step++ === 0) return click(o, "Add Oat milk");
        if (step === 2) return click(o, "Add Rolled oats");
        expect(o.text).toContain("Total: $7.00");
        return click(o, "Checkout");
      },
    );
    expect(result.output.needsReview).toBe(true);
    expect(
      fixture.events
        .slice(before)
        .filter((e) => e.path === "/cart")
        .map((e) => e.body),
    ).toEqual([{ id: "oat-milk" }, { id: "rolled-oats" }]);
    expect(
      fixture.events.slice(before).some((e) => e.path === "/purchase"),
    ).toBe(false);
    expect(
      (await readFile(path.join(dataDir, "artifacts", result.artifact!)))
        .length,
    ).toBeGreaterThan(1000);
  }, 30000);
  it("shopper with an unavailable item gets an honest blocker without an allergenic substitution", async () => {
    const before = fixture.events.length;
    const result = await runBrowserTask(
      browserData(),
      {},
      new AbortController().signal,
      task(),
      task(),
      [],
      () => {},
      async (o) => {
        expect(o.text).toContain("Out of stock");
        return {
          action: "review",
          summary:
            "Whole milk is out of stock. No substitution or order was made.",
        };
      },
    );
    expect(result.output.summary).toContain("out of stock");
    expect(fixture.events.slice(before).some((e) => e.method === "POST")).toBe(
      false,
    );
  }, 30000);
  it("cautious user's Observe setting prevents an agent from adding products", async () => {
    const before = fixture.events.length;
    await expect(
      runBrowserTask(
        browserData({ browserMode: "observe" }),
        {},
        new AbortController().signal,
        task(),
        task(),
        [],
        () => {},
        async (o) => click(o, "Add Oat milk"),
      ),
    ).rejects.toThrow("Observe mode");
    expect(fixture.events.slice(before).some((e) => e.path === "/cart")).toBe(
      false,
    );
  }, 30000);
  it("shopper receives a bounded partial result when the agent exhausts its step budget", async () => {
    const result = await runBrowserTask(
      browserData({ browserSteps: 1 }),
      {},
      new AbortController().signal,
      task(),
      task(),
      [],
      () => {},
      async () => ({ action: "scroll", direction: "down" }),
    );
    expect(result.output.needsReview).toBe(true);
    expect(result.output.summary).toContain("Stopped after 1 steps");
  }, 30000);
  it("browser navigation cannot silently leave the configured websites", async () => {
    await expect(
      runBrowserTask(
        browserData(),
        {},
        new AbortController().signal,
        task(),
        task(),
        [],
        () => {},
        async (o) => click(o, "External promotion"),
      ),
    ).rejects.toThrow("needs permission");
  }, 30000);
});
