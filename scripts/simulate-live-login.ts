// Actual Codex navigation; synthetic login and account data only.
import { createServer } from "node:http";
import { mkdtemp, writeFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { BrowserContext } from "playwright-core";
process.env.JEEVES_DATA_DIR = await mkdtemp(
  path.join(tmpdir(), "jeeves-live-login-"),
);
process.env.ENABLE_CODEX = "true";
const { runBrowserTask } = await import("../server/browser");
const { saveIntegrations } = await import("../server/integrations");
const { makeNode } = await import("../shared/schema");
const fixture = createServer((req, res) => {
  res.setHeader("Content-Type", "text/html");
  if (req.url === "/login")
    res.end(
      "<h1>Sign in to the test store</h1><label>Password<input type=\"password\"></label><button onclick=\"localStorage.setItem('signed-in','yes');location.href='/account'\">Sign in</button>",
    );
  else if (req.url === "/account")
    res.end(
      '<h1 id="status"></h1><script>document.querySelector("#status").textContent=localStorage.getItem("signed-in")==="yes"?"Welcome back, test shopper":"Sign-in required"</script>',
    );
  else
    res.end(
      '<h1>Test grocery store</h1><p>Sign in to prepare your grocery cart.</p><a href="/login">Sign in</a>',
    );
});
await new Promise<void>((resolve) => fixture.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${(fixture.address() as { port: number }).port}`;
let browser: BrowserContext | undefined;
try {
  await saveIntegrations({ origins: [origin] });
  const profile = randomUUID(),
    taskId = randomUUID(),
    started = Date.now();
  const node = makeNode("browser", "login", 0, 0, {
    provider: "codex",
    url: origin,
    browserMode: "interact",
    browserSteps: 6,
    prompt:
      "Navigate to the website sign-in page, then return review. Do not enter any account details. The user will sign in manually.",
  });
  const result = await runBrowserTask(
    node.data,
    { input: { task: "Help me find sign-in" } },
    AbortSignal.timeout(120000),
    taskId,
    profile,
    [],
    console.log,
    undefined,
    {
      visible: true,
      loginOnly: true,
      handoff: (context) => {
        browser = context;
      },
    },
  );
  if (!browser) throw new Error("No browser handoff");
  const page = browser.pages()[0];
  if (page.url() !== origin + "/login")
    throw new Error("Agent did not find sign-in");
  const navigationMs = Date.now() - started;
  const screenshots = (
    await readdir(path.join(process.env.JEEVES_DATA_DIR!, "artifacts"))
  ).filter((name) => name.startsWith(taskId));
  if (screenshots.length !== 1)
    throw new Error("Unexpected authentication screenshot");
  // Simulate the human part with a dummy password against a local-only fixture.
  await page.getByLabel("Password").fill("fixture-password-only");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(origin + "/account");
  await browser.close();
  browser = undefined;
  let restored = "";
  await runBrowserTask(
    { ...node.data, url: origin + "/account" },
    {},
    new AbortController().signal,
    randomUUID(),
    profile,
    [],
    () => {},
    async (observation) => {
      restored = observation.text;
      if (!restored.includes("Welcome back, test shopper"))
        throw new Error("Session did not persist");
      return { action: "done", summary: "Saved account session restored" };
    },
  );
  const report = {
    verifiedAt: new Date().toISOString(),
    provider: "Real authenticated Codex CLI",
    browser: "Installed Chrome, visible navigation and handoff",
    fixture: "Local synthetic store; no real credentials or account access",
    navigationMs,
    agentActions: result.output.actions,
    screenshotsBeforeHandoff: screenshots.length,
    authenticationScreenshots: 0,
    manualPhase:
      "Simulated human entry using Playwright after CUA stopped observing",
    restoredAccount: restored,
  };
  await writeFile(
    "docs/simulation-login-live-verification.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  await browser?.close();
  await new Promise<void>((resolve) => fixture.close(() => resolve()));
}
