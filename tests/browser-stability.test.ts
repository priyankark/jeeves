import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { chromium, type BrowserContext } from "playwright-core";
import { runBrowserTask, type BrowserPlanner } from "../server/browser";
import { saveIntegrations } from "../server/integrations";
import { makeNode } from "../shared/schema";

let origin: string;
let context: BrowserContext;
let clicks = 0;
const site = createServer((req, res) => {
  if (req.url === "/clicked") {
    clicks++;
    res.end("ok");
    return;
  }
  res.setHeader("Content-Type", "text/html");
  if (req.url === "/covered-center") {
    res.end(
      `<div style="position:relative;width:320px;height:260px"><a id="search" href="#product" style="display:block;width:320px;height:260px"><span style="position:absolute;bottom:15px;left:20px">Find prices</span></a><div style="position:absolute;inset:0 0 65px;background:white">Price box covering the link center</div></div><p id="result"></p><script>document.querySelector('#search').addEventListener('click',()=>{document.querySelector('#result').textContent='Prices found';fetch('/clicked')})</script>`,
    );
    return;
  }
  res.end(`<h1>Changing store</h1><div id="controls"><button id="search">Find prices</button></div><p id="result"></p><script>
    document.addEventListener('click',e=>{if(e.target.id==='search'){document.querySelector('#result').textContent='Prices found';fetch('/clicked')}});
  </script>`);
});
beforeAll(async () => {
  await new Promise<void>((resolve) => site.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(site.address() as { port: number }).port}`;
  await saveIntegrations({ origins: [origin] });
});
afterAll(() => new Promise<void>((resolve) => site.close(() => resolve())));
afterEach(() => vi.restoreAllMocks());
async function run(planner: BrowserPlanner, steps = 4, pathname = "") {
  clicks = 0;
  const launch = chromium.launchPersistentContext.bind(chromium);
  vi.spyOn(chromium, "launchPersistentContext").mockImplementation(
    async (...args) => {
      context = await launch(...args);
      return context;
    },
  );
  const events: string[] = [];
  const result = await runBrowserTask(
    makeNode("browser", "search", 0, 0, {
      url: origin + pathname,
      browserMode: "interact",
      browserSteps: steps,
    }).data,
    {},
    new AbortController().signal,
    randomUUID(),
    randomUUID(),
    [],
    (message) => events.push(message),
    planner,
  );
  return { result, events };
}
it("refreshes controls after a retailer rerenders while the model is thinking, without consuming the action budget", async () => {
  let observations = 0;
  const { result, events } = await run(async (observation) => {
    observations++;
    if (observations === 1) {
      await context.pages()[0].evaluate(() => {
        document.querySelector("#controls")!.innerHTML =
          '<button id="search">Find prices</button>';
      });
    } else if (observations === 2) {
      expect(observation.notice).toContain("NOT executed");
    } else {
      expect(observation.text).toContain("Prices found");
      return {
        action: "done",
        summary: "Prices found after refreshing the view.",
      };
    }
    return {
      action: "click",
      target: observation.controls.find((c) => c.name === "Find prices")!.id,
    };
  }, 2);
  expect(result.output.needsReview).toBe(false);
  expect(clicks).toBe(1);
  expect(result.output.actions).toHaveLength(1);
  expect(
    events.some((message) => message.includes("refreshing the page view")),
  ).toBe(true);
}, 20000);

it("continually changing controls produce a bounded human handoff instead of a locator error", async () => {
  let observations = 0;
  const { result } = await run(async (observation) => {
    observations++;
    await context.pages()[0].evaluate(() => {
      document.querySelector("#controls")!.innerHTML =
        '<button id="search">Find prices</button>';
    });
    return { action: "click", target: observation.controls[0].id };
  });
  expect(observations).toBe(4);
  expect(clicks).toBe(0);
  expect(result.output.needsReview).toBe(true);
  expect(result.output.summary).toContain("Open the browser");
  expect(result.output.summary).not.toMatch(/locator|Timeout|Call log/);
  expect(result.artifact).toMatch(/browser-review\.png$/);
}, 20000);

it("replans when a popup covers a control and acts only after the obstruction is gone", async () => {
  let observations = 0;
  const { result } = await run(async (observation) => {
    observations++;
    if (observations === 1) {
      await context.pages()[0].evaluate(() => {
        const popup = document.createElement("div");
        popup.id = "popup";
        popup.style.cssText =
          "position:fixed;inset:0;background:white;z-index:9999";
        document.body.append(popup);
      });
    } else if (observations === 2) {
      expect(observation.notice).toContain("covered");
      await context
        .pages()[0]
        .evaluate(() => document.querySelector("#popup")!.remove());
    } else return { action: "done", summary: "Search completed." };
    return { action: "click", target: observation.controls[0].id };
  });
  expect(clicks).toBe(1);
  expect(result.output.needsReview).toBe(false);
}, 20000);

it("never repeats a dispatched action whose result could not be confirmed", async () => {
  const { result } = await run(async (observation) => {
    const handle = await context.pages()[0].$("#search");
    const prototype = Object.getPrototypeOf(handle!);
    const click = prototype.click;
    vi.spyOn(prototype, "click").mockImplementation(async function (
      this: unknown,
      options: any,
    ) {
      await click.call(this, options);
      if (!options?.trial)
        throw new Error("Timeout after the action was dispatched");
    });
    await handle!.dispose();
    return { action: "click", target: observation.controls[0].id };
  });
  expect(clicks).toBe(1);
  expect(result.output.needsReview).toBe(true);
  expect(result.output.summary).toContain("has not repeated the action");
  expect(result.output.actions).toEqual([
    { action: "click", target: 0, outcome: "unconfirmed" },
  ]);
}, 20000);

it("clicks exposed link text when a price box covers the center of a product card", async () => {
  const { result, events } = await run(
    async (observation, history) => {
      if (history.length) {
        expect(observation.text).toContain("Prices found");
        return { action: "done", summary: "Opened the selected product." };
      }
      return {
        action: "click",
        target: observation.controls.find((c) => c.name === "Find prices")!.id,
      };
    },
    2,
    "/covered-center",
  );
  expect(result.output.needsReview).toBe(false);
  expect(clicks).toBe(1);
  expect(events.some((message) => message.includes("refreshing"))).toBe(false);
}, 20000);
