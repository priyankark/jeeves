import { beforeAll, afterAll, it, expect } from "vitest";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readdir } from "node:fs/promises";
import path from "node:path";
import type { BrowserContext } from "playwright-core";
import { saveIntegrations } from "../server/integrations";
import { runBrowserTask } from "../server/browser";
import {
  startLogin,
  finishLogin,
  focusLogin,
  loginStatus,
} from "../server/browser-login";
import { makeNode } from "../shared/schema";
import { blank } from "../shared/templates";
import { dataDir } from "../server/providers";
const server = createServer((req, res) => {
  res.setHeader("Content-Type", "text/html");
  if (req.url === "/login")
    res.end(
      "<h1>Sign in</h1><label>Password<input type=\"password\"></label><button onclick=\"localStorage.setItem('signed-in','yes');location.href='/account'\">Sign in</button>",
    );
  else if (req.url === "/account")
    res.end(
      '<h1 id="state"></h1><script>state.textContent=localStorage.getItem("signed-in")==="yes"?"Welcome back, shopper":"Sign-in required"</script>',
    );
  else res.end('<h1>Fixture shop</h1><a href="/login">Sign in</a>');
});
let origin: string;
beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  await saveIntegrations({ origins: [origin] });
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
const node = () =>
  makeNode("browser", "shop", 0, 0, {
    url: origin,
    browserMode: "interact",
    browserSteps: 4,
  });
it("CUA finds sign-in, stops observing before credentials, and preserves manual login for the next workflow run", async () => {
  const profile = randomUUID(),
    taskId = randomUUID();
  let browser: BrowserContext | undefined,
    calls = 0;
  try {
    const result = await runBrowserTask(
      node().data,
      {},
      new AbortController().signal,
      taskId,
      profile,
      [],
      () => {},
      async (observation) => {
        calls++;
        expect(observation.url).toBe(origin + "/");
        expect(observation.text).not.toContain("Password");
        return {
          action: "click",
          target: observation.controls.find((c) => c.name === "Sign in")!.id,
        };
      },
      {
        loginOnly: true,
        handoff: (context) => {
          browser = context;
        },
      },
    );
    expect(result.output.needsReview).toBe(true);
    expect(calls).toBe(1);
    expect(
      (await readdir(path.join(dataDir, "artifacts"))).filter((name) =>
        name.startsWith(taskId),
      ),
    ).toEqual([`${taskId}-browser-0.png`]);
    const page = browser!.pages()[0];
    expect(page.url()).toBe(origin + "/login");
    await expect(
      runBrowserTask(
        node().data,
        {},
        new AbortController().signal,
        randomUUID(),
        profile,
        [],
        () => {},
        async () => ({ action: "done", summary: "unexpected" }),
      ),
    ).rejects.toThrow("already open");
    await page.getByLabel("Password").fill("fixture-only-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(origin + "/account");
    await browser!.close();
    browser = undefined;
    await runBrowserTask(
      { ...node().data, url: origin + "/account" },
      {},
      new AbortController().signal,
      randomUUID(),
      profile,
      [],
      () => {},
      async (observation) => {
        expect(observation.text).toContain("Welcome back, shopper");
        return { action: "done", summary: "Saved session works" };
      },
    );
  } finally {
    await browser?.close();
  }
}, 30000);
it("login coordinator deduplicates sessions, waits for handoff, and reports user confirmation without claiming verification", async () => {
  const workflow = { ...blank, id: randomUUID(), nodes: [node()] };
  const session = startLogin(
    workflow,
    "shop",
    {},
    [],
    async () => ({ action: "review", summary: "Please sign in" }),
    false,
  );
  try {
    expect(startLogin(workflow, "shop", {}, [], undefined, false).id).toBe(
      session.id,
    );
    await expect(finishLogin(session.id)).rejects.toThrow("Wait for Jeeves");
    await expect(focusLogin(session.id)).rejects.toThrow("no longer waiting");
    await expect
      .poll(() => loginStatus(session.id).status, { timeout: 10000 })
      .toBe("waiting");
    await expect(focusLogin(session.id)).resolves.toEqual({ focused: true });
    const finished = await finishLogin(session.id);
    await expect(focusLogin(session.id)).rejects.toThrow("no longer waiting");
    expect(finished.status).toBe("completed");
    expect(finished.message).toContain("You confirmed sign-in");
    await runBrowserTask(
      node().data,
      {},
      new AbortController().signal,
      randomUUID(),
      `${workflow.id}-shop`,
      [],
      () => {},
      async () => ({ action: "done", summary: "Profile released" }),
    );
  } finally {
    await finishLogin(session.id, true);
  }
}, 30000);
it("cancelled CUA navigation remains cancelled even when its planner returns late", async () => {
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  let observed = false;
  const workflow = { ...blank, id: randomUUID(), nodes: [node()] };
  const session = startLogin(
    workflow,
    "shop",
    {},
    [],
    async () => {
      observed = true;
      await waiting;
      return { action: "review", summary: "Too late" };
    },
    false,
  );
  try {
    await expect.poll(() => observed, { timeout: 10000 }).toBe(true);
    await finishLogin(session.id, true);
    release();
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(loginStatus(session.id).status).toBe("cancelled");
  } finally {
    release();
    await finishLogin(session.id, true);
  }
}, 30000);
it("CUA login refuses automated account detail entry", async () => {
  await expect(
    runBrowserTask(
      node().data,
      {},
      new AbortController().signal,
      randomUUID(),
      randomUUID(),
      [],
      () => {},
      async () => ({ action: "fill", target: 0, text: "user@example.com" }),
      { loginOnly: true },
    ),
  ).rejects.toThrow("only navigates");
}, 30000);
