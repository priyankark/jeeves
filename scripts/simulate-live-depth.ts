// Real Codex + Chrome over synthetic groceries, followed by a read-only public GitHub check.
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
process.env.JEEVES_DATA_DIR = await mkdtemp(
  path.join(tmpdir(), "jeeves-live-depth-"),
);
process.env.ENABLE_CODEX = "true";
const { simulationServer } =
  await import("../tests/fixtures/simulation-server");
const { saveIntegrations } = await import("../server/integrations");
const { runBrowserTask, openWorkflowBrowser } =
  await import("../server/browser");
const { makeNode } = await import("../shared/schema");
const { executeHttpAction } = await import("../server/http-action");
const fixture = await simulationServer();
try {
  await saveIntegrations({
    origins: [fixture.origin, "https://api.github.com"],
  });
  const profile = randomUUID();
  const started = Date.now();
  const node = makeNode("browser", "shop", 0, 0, {
    provider: "codex",
    url: fixture.origin + "/options",
    browserMode: "interact",
    browserSteps: 8,
    prompt:
      "Prepare exactly two bottles of oat milk for a budget of $10. Set quantity to two and disable substitutions before adding to cart. Verify the resulting cart, then return review. Do not click Checkout. Do not add the items again if the cart already contains them.",
  });
  const result = await runBrowserTask(
    node.data,
    {
      input: { task: "Two bottles of oat milk, no substitutions, under $10." },
    },
    new AbortController().signal,
    randomUUID(),
    profile,
    [],
    (message) => console.log(message),
  );
  const additions = fixture.events
    .filter((e) => e.path === "/cart")
    .map((e) => e.body);
  if (
    JSON.stringify(additions) !==
    JSON.stringify([{ quantity: 2, substitutions: false }])
  )
    throw new Error("Wrong cart: " + JSON.stringify(additions));
  if (fixture.events.some((e) => e.path === "/purchase"))
    throw new Error("Purchase attempted.");
  console.log("Reopening saved session for manual review");
  const review = await openWorkflowBrowser(
    profile,
    fixture.origin + "/options",
  );
  let reviewText = "";
  try {
    reviewText = await review.pages()[0].locator("#result").innerText();
    if (!reviewText.includes("2 bottles. Substitutions: false"))
      throw new Error("Saved cart not restored");
    await review
      .pages()[0]
      .screenshot({ path: "docs/grocery-options-live.png" });
  } finally {
    await review.close();
  }
  const browserMs = Date.now() - started;
  const github = await executeHttpAction(
    makeNode("action", "issues", 0, 0, {
      url: "https://api.github.com/repos/nodejs/node/issues?state=open&per_page=1",
      paginate: true,
      maxPages: 2,
    }).data,
    {},
    new AbortController().signal,
  );
  const page = github.output as {
    items: { number: number; html_url: string }[];
    pagination: unknown;
  };
  if (page.items.length !== 2)
    throw new Error("Public GitHub pagination did not return two items");
  const report = {
    verifiedAt: new Date().toISOString(),
    browser: {
      provider: "Codex CLI",
      fixture: "Local synthetic grocery options",
      durationMs: browserMs,
      ...result.output,
      manualReviewText: reviewText,
      purchases: 0,
    },
    github: {
      repository: "nodejs/node",
      method: "GET",
      credentialsUsed: false,
      items: page.items.map((i) => ({ number: i.number, url: i.html_url })),
      pagination: page.pagination,
    },
  };
  await writeFile(
    "docs/simulation-depth-live-verification.json",
    JSON.stringify(report, null, 2),
  );
  console.log(
    "PASS: live grocery options, restored manual review, and real GitHub pagination.",
  );
} finally {
  await fixture.close();
}
