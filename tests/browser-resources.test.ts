import { afterAll, beforeAll, expect, it } from "vitest";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { saveIntegrations } from "../server/integrations";
import { runBrowserTask } from "../server/browser";
import { makeNode } from "../shared/schema";
let origin: string,
  assetOrigin: string,
  assetRequests = 0;
const assets = createServer((_req, res) => {
  assetRequests++;
  res.end("blocked content");
});
const site = createServer((req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.end(
    req.url === "/styles"
      ? `<link rel="stylesheet" href="${assetOrigin}/style.css"><h1>Shop</h1>`
      : `<h1>Shop</h1><iframe src="${assetOrigin}/ad"></iframe><button>Add milk</button>`,
  );
});
beforeAll(async () => {
  for (const server of [site, assets])
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
  origin = `http://127.0.0.1:${(site.address() as { port: number }).port}`;
  assetOrigin = `http://127.0.0.1:${(assets.address() as { port: number }).port}`;
  await saveIntegrations({ origins: [origin], allowAllWebsites: false });
});
afterAll(async () => {
  for (const server of [site, assets])
    await new Promise<void>((resolve) => server.close(() => resolve()));
});
it("a blocked advertising iframe does not fail the main website or contact the blocked origin", async () => {
  const result = await runBrowserTask(
    makeNode("browser", "shop", 0, 0, { url: origin, browserMode: "interact" })
      .data,
    {},
    new AbortController().signal,
    randomUUID(),
    randomUUID(),
    [],
    () => {},
    async (observation) => {
      expect(observation.text).toContain("Shop");
      return { action: "review", summary: "Main shop is usable" };
    },
  );
  expect(result.output.summary).toBe("Main shop is usable");
  expect(assetRequests).toBe(0);
}, 20000);
it("blocked styles produce a recoverable permission error before an agent clicks a broken page", async () => {
  let planned = false;
  await expect(
    runBrowserTask(
      makeNode("browser", "shop", 0, 0, { url: origin + "/styles" }).data,
      {},
      new AbortController().signal,
      randomUUID(),
      randomUUID(),
      [],
      () => {},
      async () => {
        planned = true;
        return { action: "done", summary: "wrong" };
      },
    ),
  ).rejects.toThrow(`Allow ${assetOrigin} in Settings`);
  expect(planned).toBe(false);
  expect(assetRequests).toBe(0);
}, 20000);
