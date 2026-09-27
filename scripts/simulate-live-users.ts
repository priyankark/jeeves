// Synthetic tasks only. Makes real Codex calls when explicitly invoked.
import { mkdtemp, writeFile, copyFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
const dir = await mkdtemp(path.join(tmpdir(), "jeeves-live-personas-"));
process.env.JEEVES_DATA_DIR = dir;
process.env.ENABLE_CODEX = "true";
const { simulationServer } =
  await import("../tests/fixtures/simulation-server");
const { saveIntegrations } = await import("../server/integrations");
const { createRun, executeRun } = await import("../server/engine");
const { githubTriage, groceryCart } = await import("../shared/templates");
const fixture = await simulationServer();
await saveIntegrations({
  origins: [fixture.origin],
  secret: {
    name: "GITHUB_TOKEN",
    origin: fixture.origin,
    value: "fixture-maintainer-token",
  },
});
const results: unknown[] = [];
try {
  for (const [persona, source] of [
    ["GitHub maintainer", githubTriage],
    ["Budget and allergy-conscious shopper", groceryCart],
  ] as const) {
    const workflow = structuredClone(source);
    workflow.id = randomUUID();
    for (const node of workflow.nodes) {
      if (node.data.kind === "agent" || node.data.kind === "browser")
        node.data.provider = "codex";
      if (node.data.kind === "action") {
        node.data.url = node.data.url.replace(
          "https://api.github.com",
          fixture.origin,
        );
        node.data.authEnv = "GITHUB_TOKEN";
      }
      if (node.data.kind === "browser")
        node.data.url = fixture.origin + "/shop";
    }
    const input = JSON.parse(workflow.input);
    if (source === githubTriage) {
      input.owner = "acme";
      input.repo = "project";
    }
    const run = createRun(workflow, "live", randomUUID());
    console.log("START", persona);
    let last = "";
    const timer = setInterval(() => {
      const current = run.events.at(-1)?.message;
      if (current && current !== last) {
        console.log(persona + ": " + current);
        last = current;
      }
    }, 3000);
    try {
      await executeRun(run, input, new AbortController().signal);
    } finally {
      clearInterval(timer);
    }
    const output = run.nodes.output.output;
    if (run.status !== "completed") throw new Error(persona + ": " + run.error);
    if (source === githubTriage && !JSON.stringify(output).includes("12"))
      throw new Error("Maintainer did not reference the fixture issue.");
    if (source === groceryCart) {
      const adds = fixture.events
        .filter((e) => e.path === "/cart")
        .map((e) => (e.body as { id: string }).id);
      if (
        JSON.stringify([...adds].sort()) !==
        JSON.stringify(["oat-milk", "rolled-oats"].sort())
      )
        throw new Error("Unexpected cart: " + JSON.stringify(adds));
      if (fixture.events.some((e) => e.path === "/purchase"))
        throw new Error("Checkout was submitted.");
      const screenshot = (output as { screenshot: string }).screenshot;
      await copyFile(
        path.join(dir, "artifacts", screenshot),
        "docs/grocery-browser-simulation.png",
      );
    }
    results.push({
      persona,
      status: run.status,
      mode: run.mode,
      provider: "codex",
      durationMs: Date.parse(run.finishedAt!) - Date.parse(run.startedAt),
      output,
      events: run.events,
    });
    console.log("PASS", persona);
  }
  await mkdir("docs", { recursive: true });
  await writeFile(
    "docs/simulation-live-verification.json",
    JSON.stringify(
      {
        verifiedAt: new Date().toISOString(),
        environment:
          "Local synthetic GitHub API and grocery storefront; real Chrome and Codex CLI. No real account data, purchases or repository writes.",
        results,
        purchases: fixture.events.filter((e) => e.path === "/purchase").length,
      },
      null,
      2,
    ),
  );
  console.log("Saved docs/simulation-live-verification.json");
} finally {
  await fixture.close();
}
