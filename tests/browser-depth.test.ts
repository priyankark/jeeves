import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { simulationServer } from "./fixtures/simulation-server";
import { saveIntegrations } from "../server/integrations";
import { runBrowserTask, type BrowserObservation } from "../server/browser";
import { makeNode } from "../shared/schema";
import { dataDir } from "../server/providers";
import * as providers from "../server/providers";
import { createRun, executeRun } from "../server/engine";
import { blank } from "../shared/templates";
import { readJson } from "../server/storage";
let fixture: Awaited<ReturnType<typeof simulationServer>>;
beforeAll(async () => {
  fixture = await simulationServer();
  await saveIntegrations({ origins: [fixture.origin] });
});
afterAll(() => fixture.close());
const id = () => randomUUID();
const data = () =>
  makeNode("browser", "shop", 0, 0, {
    url: fixture.origin + "/options",
    browserMode: "interact",
    browserSteps: 8,
  }).data;
const target = (o: BrowserObservation, name: string) =>
  o.controls.find((c) => c.name === name)!.id;
it("shopper chooses quantity and disables substitutions, then keeps the cart across sessions", async () => {
  const profile = id();
  let step = 0;
  const before = fixture.events.length;
  const result = await runBrowserTask(
    data(),
    {},
    new AbortController().signal,
    id(),
    profile,
    [],
    () => {},
    async (o) => {
      if (step++ === 0)
        return { action: "select", target: target(o, "Quantity"), value: "2" };
      if (step === 2)
        return {
          action: "check",
          target: target(o, "Allow substitutions"),
          checked: false,
        };
      if (step === 3)
        return { action: "click", target: target(o, "Add configured milk") };
      expect(o.text).toContain("Cart: 2 bottles. Substitutions: false");
      return {
        action: "review",
        summary: "Two bottles, $8. No substitutions.",
      };
    },
  );
  expect(result.output.needsReview).toBe(true);
  expect(
    fixture.events
      .slice(before)
      .filter((e) => e.path === "/cart")
      .map((e) => e.body),
  ).toEqual([{ quantity: 2, substitutions: false }]);
  await runBrowserTask(
    data(),
    {},
    new AbortController().signal,
    id(),
    profile,
    [],
    () => {},
    async (o) => {
      expect(o.text).toContain("Cart: 2 bottles. Substitutions: false");
      return {
        action: "review",
        summary: "Existing cart retained; no duplicate additions.",
      };
    },
  );
  expect(
    fixture.events.slice(before).filter((e) => e.path === "/cart"),
  ).toHaveLength(1);
}, 30000);
it("agent sees disabled controls and option availability but not invisible promotions", async () => {
  await runBrowserTask(
    data(),
    {},
    new AbortController().signal,
    id(),
    id(),
    [],
    () => {},
    async (o) => {
      expect(
        o.controls.find((c) => c.name === "Add unavailable milk"),
      ).toMatchObject({ disabled: true });
      expect(o.controls.some((c) => c.name === "Invisible promotion")).toBe(
        false,
      );
      expect(o.controls.find((c) => c.name === "Quantity")).toMatchObject({
        options: [
          { value: "1", label: "One bottle", disabled: false },
          { value: "2", label: "Two bottles", disabled: false },
          { value: "3", label: "Three bottles — unavailable", disabled: true },
        ],
      });
      return {
        action: "review",
        summary: "Unavailable options correctly identified.",
      };
    },
  );
}, 30000);
it("failed browser task preserves a screenshot and frees its session for retry", async () => {
  const profile = id();
  let caught: unknown;
  try {
    await runBrowserTask(
      data(),
      {},
      new AbortController().signal,
      id(),
      profile,
      [],
      () => {},
      async () => ({ action: "invented-action" }),
    );
  } catch (e) {
    caught = e;
  }
  expect(caught).toMatchObject({ artifact: expect.stringMatching(/\.png$/) });
  const artifact = (caught as { artifact: string }).artifact;
  expect(
    (await readFile(path.join(dataDir, "artifacts", artifact))).length,
  ).toBeGreaterThan(1000);
  await expect(
    runBrowserTask(
      data(),
      {},
      new AbortController().signal,
      id(),
      profile,
      [],
      () => {},
      async () => ({ action: "review", summary: "Retry works." }),
    ),
  ).resolves.toBeDefined();
}, 30000);
it("cancelled browser task cannot return success and releases its profile", async () => {
  const stop = new AbortController(),
    profile = id();
  await expect(
    runBrowserTask(
      data(),
      {},
      stop.signal,
      id(),
      profile,
      [],
      () => {},
      async () => {
        stop.abort();
        return { action: "done", summary: "Should not complete" };
      },
    ),
  ).rejects.toThrow();
  await expect(
    runBrowserTask(
      data(),
      {},
      new AbortController().signal,
      id(),
      profile,
      [],
      () => {},
      async () => ({ action: "review", summary: "Session released." }),
    ),
  ).resolves.toBeDefined();
}, 30000);
it("unavailable select options are rejected without changing the cart", async () => {
  const before = fixture.events.length;
  await expect(
    runBrowserTask(
      data(),
      {},
      new AbortController().signal,
      id(),
      id(),
      [],
      () => {},
      async (o) => ({
        action: "select",
        target: target(o, "Quantity"),
        value: "3",
      }),
    ),
  ).rejects.toThrow("option for “Quantity” is unavailable");
  expect(fixture.events.slice(before).some((e) => e.path === "/cart")).toBe(
    false,
  );
}, 30000);

it("failed run persists its last browser screenshot for Home and checkpoint inspection", async () => {
  const generation = vi
    .spyOn(providers, "generate")
    .mockResolvedValue('{"action":"invalid"}');
  try {
    const workflow = {
      ...blank,
      id: id(),
      nodes: [
        blank.nodes[0],
        { ...makeNode("browser", "shop", 300, 0), data: data() },
        blank.nodes[1],
      ],
      edges: [
        { id: "a", source: "input", target: "shop" },
        { id: "b", source: "shop", target: "output" },
      ],
    };
    const run = createRun(workflow, "live", id());
    await executeRun(run, {}, new AbortController().signal);
    expect(run.status).toBe("failed");
    expect(run.nodes.shop.artifact).toMatch(/\.png$/);
    const persisted = await readJson<typeof run>("runs", run.id);
    expect(persisted.nodes.shop.artifact).toBe(run.nodes.shop.artifact);
    expect(persisted.nodes.shop.browserUrl).toBe(fixture.origin + "/options");
    expect(
      (
        await readFile(
          path.join(dataDir, "artifacts", persisted.nodes.shop.artifact!),
        )
      ).length,
    ).toBeGreaterThan(1000);
  } finally {
    generation.mockRestore();
  }
}, 30000);

it("manual browser handoff preserves the cart and releases the profile on explicit continuation", async () => {
  const { openWorkflowBrowser, finishManualBrowser } =
    await import("../server/browser");
  const profile = id();
  const manual = await openWorkflowBrowser(
    profile,
    fixture.origin + "/options",
  );
  try {
    const page = manual.pages()[0];
    await page
      .getByRole("button", { name: "Add configured milk", exact: true })
      .click();
    await expect(
      page.getByText("Cart: 1 bottles. Substitutions: true").isVisible(),
    ).resolves.toBe(true);
    expect(
      await openWorkflowBrowser(profile, fixture.origin + "/options"),
    ).toBe(manual);
    const url = await finishManualBrowser(profile);
    expect(url).toBe(fixture.origin + "/options");
    await runBrowserTask(
      data(),
      {},
      new AbortController().signal,
      id(),
      profile,
      [],
      () => {},
      async (observation) => {
        expect(observation.text).toContain(
          "Cart: 1 bottles. Substitutions: true",
        );
        return {
          action: "done",
          summary: "The human's cart change is preserved.",
        };
      },
    );
  } finally {
    await manual.close();
  }
}, 30000);
