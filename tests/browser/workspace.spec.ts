import { starter } from "../../shared/templates";
import { test, expect } from "@playwright/test";
test("research workflow runs both branches, writes artifacts, and persists edits", async ({
  page,
  request,
}) => {
  await request.put(`/api/workflows/${starter.id}`, { data: starter });
  await page.addInitScript(
    (id) => localStorage.setItem("jeeves-workflow", id),
    starter.id,
  );
  const browserErrors: string[] = [];
  page.on("pageerror", (e) => browserErrors.push(e.message));
  await page.goto("/#editor");
  await expect(page.getByText("Local engine connected")).toBeVisible();
  await expect(page.locator(".flow-node")).toHaveCount(7);
  await page.getByRole("button", { name: "Run workflow", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Everything connected." }),
  ).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".trace-item.skipped")).toContainText(
    "Review specialist",
  );
  await page
    .locator(".trace-item")
    .filter({ hasText: "Research handoff" })
    .click();
  const link = page.getByRole("link", { name: "Download handoff" });
  await expect(link).toBeVisible();
  const artifact = await request.get((await link.getAttribute("href"))!);
  expect(artifact.status()).toBe(200);
  expect(await artifact.text()).toContain("Connected context");
  await page.getByRole("button", { name: "Run input", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Workflow input JSON" })
    .fill('{"task":"Review my proposal", "demo_jev_value": 0.5}');
  await page.getByRole("button", { name: "Close run input" }).click();
  await page.getByRole("button", { name: "Run workflow", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Everything connected." }),
  ).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".trace-item.skipped")).toContainText(
    "Brief writer",
  );
  await page
    .getByRole("textbox", { name: "Workflow name", exact: true })
    .fill("My working flow");
  await expect(page.getByText("Saved locally")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Workflow name", exact: true }),
  ).toHaveValue("My working flow");
  expect(browserErrors).toEqual([]);
});
test("adds and configures nodes, applies a copilot proposal, and cancels a run", async ({
  page,
}) => {
  await page.goto("/#editor");
  await expect(page.getByText("Local engine connected")).toBeVisible();
  await page.getByRole("button", { name: "Add node", exact: true }).click();
  await page
    .getByRole("button", { name: "Action Call an API without an agent loop." })
    .click();
  await page.getByLabel("Endpoint URL").fill("https://example.com/api");
  await page.getByLabel("Node name", { exact: true }).fill("My action");
  await page.getByRole("button", { name: "Validate", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("not connected");
  await page.getByRole("button", { name: "Dismiss error" }).click();
  await page.getByRole("button", { name: "Copilot", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Message copilot" })
    .fill("Draft something and review it");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.getByText("Workflow proposal", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Apply to canvas" }).click();
  await expect(page.locator(".flow-node")).toHaveCount(5);
  await page.getByRole("button", { name: "Run workflow", exact: true }).click();
  await page.getByRole("button", { name: "Stop run", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Run stopped." }),
  ).toBeVisible();
});
test("rejects cross-origin requests and malformed graphs", async ({
  request,
}) => {
  const cross = await request.post("/api/runs", {
    headers: { Origin: "https://untrusted.example" },
    data: {},
  });
  expect(cross.status()).toBe(403);
  const malformed = await request.post("/api/runs", {
    data: { workflow: { id: "../../escape" } },
  });
  expect(malformed.status()).toBe(400);
});
test("Jev inspector exposes typed questions and displays uncertainty", async ({
  page,
}) => {
  await page.goto("/#editor");
  await expect(page.getByText("Local engine connected")).toBeVisible();
  await page.getByRole("button", { name: "Templates", exact: true }).click();
  await page
    .getByRole("button", { name: /Research to brief.*7 nodes/ })
    .click();
  await page.locator(".flow-node.decision").click();
  await expect(page.getByLabel("Decision engine")).toHaveValue("jev");
  await page.getByLabel("Question type").selectOption("choice");
  await page
    .getByLabel("Named options (JSON object)")
    .fill('{"research":"Explore evidence","write":"Produce a draft"}');
  await expect(
    page
      .locator(".flow-node.decision .port-label")
      .filter({ hasText: "research" }),
  ).toBeVisible();
  await expect(
    page
      .locator(".flow-node.decision .port-label")
      .filter({ hasText: "write" }),
  ).toBeVisible();
  await page.getByLabel("Question type").selectOption("noul");
  await page.getByRole("button", { name: "Run input", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Workflow input JSON" })
    .fill('{"task":"Review evidence", "demo_jev_value":0.5}');
  await page.getByRole("button", { name: "Close run input" }).click();
  await page.getByRole("button", { name: "Run workflow", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Everything connected." }),
  ).toBeVisible({ timeout: 15000 });
  await page
    .locator(".trace-item")
    .filter({ hasText: "Ready to synthesize?" })
    .click();
  await expect(page.locator(".jev-outcome")).toContainText("50%");
  await expect(page.locator(".jev-route")).toContainText("review");
  await expect(page.locator(".jev-result")).toContainText("Demo fixture");
});

test("undo and redo recover a deleted node without losing its connections", async ({
  page,
}) => {
  await page.goto("/#editor");
  await expect(page.getByText("Local engine connected")).toBeVisible();
  await page.getByRole("button", { name: "Templates", exact: true }).click();
  await page
    .getByRole("button", { name: /Research to brief.*7 nodes/ })
    .click();
  await page.locator(".flow-node.handoff").click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.locator(".flow-node")).toHaveCount(6);
  await page.getByRole("button", { name: "Undo edit" }).click();
  await expect(page.locator(".flow-node")).toHaveCount(7);
  await page.getByRole("button", { name: "Validate", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("valid");
  await page.getByRole("button", { name: "Redo edit" }).click();
  await expect(page.locator(".flow-node")).toHaveCount(6);
});

test("stopped runs resume from checkpoints and final output is readable", async ({
  page,
  request,
}) => {
  const { starter } = await import("../../shared/templates");
  const workflow = structuredClone(starter);
  workflow.id = "checkpoint-browser";
  workflow.name = "Checkpoint browser";
  const created = await request.post("/api/runs", {
    data: {
      workflow,
      mode: "demo",
      input: { task: "Checkpoint fixture", demo_jev_value: 0.9 },
    },
  });
  const run = await created.json();
  await expect
    .poll(async () => {
      const current = await (await request.get(`/api/runs/${run.id}`)).json();
      return current.nodes.input.status;
    })
    .toBe("completed");
  await request.post(`/api/runs/${run.id}/cancel`);
  await expect
    .poll(
      async () =>
        (await (await request.get(`/api/runs/${run.id}`)).json()).status,
    )
    .toBe("cancelled");
  await page.goto("/#editor");
  await expect(page.getByText("Local engine connected")).toBeVisible();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Run history", exact: true })
    .click();
  await page
    .locator(".history-list>button")
    .filter({ hasText: "Checkpoint browser" })
    .click();
  await page.getByRole("button", { name: "Resume from checkpoint" }).click();
  await expect(
    page.getByRole("heading", { name: "Everything connected." }),
  ).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".checkpoint-note")).toBeVisible();
  await expect(
    page.locator(".trace-item").filter({ hasText: "Workflow input" }),
  ).toContainText("checkpoint");
  await page.getByRole("button", { name: "Read final output" }).click();
  await expect(
    page.getByRole("dialog", { name: "Workflow output" }),
  ).toBeVisible();
  await expect(page.locator(".output-modal .markdown-output")).toContainText(
    "Demo",
  );
  const download = page.waitForEvent("download");
  await page
    .getByRole("dialog", { name: "Workflow output" })
    .getByRole("button", { name: "Download output" })
    .click();
  expect((await download).suggestedFilename()).toBe("output.md");
});

test("provider settings save and verify credentials without storing secrets in browser preferences", async ({
  page,
}) => {
  await page.route("**/api/connections", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.apiKey).toBe("test-secret-only");
    await route.fulfill({
      json: {
        providers: {
          typesafe: false,
          openai: true,
          openrouter: false,
          local: false,
          codex: false,
          models: {
            openai: "test-model",
            openrouter: "",
            local: "",
            codex: "",
          },
        },
      },
    });
  });
  await page.route("**/api/connections/openai/check", (route) =>
    route.fulfill({
      json: {
        provider: "openai",
        ok: true,
        detail: "Provider authenticated.",
        latencyMs: 20,
        checkedAt: new Date().toISOString(),
      },
    }),
  );
  await page.goto("/#editor");
  await expect(page.getByText("Local engine connected")).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const card = page.locator(".connection-card").filter({ hasText: "OpenAI" });
  await card.getByRole("button", { name: "Connect", exact: true }).click();
  await page.getByLabel("OpenAI API key").fill("test-secret-only");
  await card.getByLabel("Default model").fill("test-model");
  await card.getByRole("button", { name: "Save and verify" }).click();
  await expect(card.getByText("Verified", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    "test-secret-only",
  );
});

test("retrying a possibly completed POST requires an explicit decision", async ({
  page,
}) => {
  await page.route("**/api/runs/*/resume", async (route) => {
    const body = route.request().postDataJSON();
    if (!body.confirmActions)
      await route.fulfill({
        status: 409,
        json: {
          error: "Create record may already have reached its destination.",
          requiresActionConfirmation: true,
        },
      });
    else
      await route.fulfill({
        status: 409,
        json: { error: "Test retry acknowledged; no action was executed." },
      });
  });
  await page.goto("/#editor");
  await expect(page.getByText("Local engine connected")).toBeVisible();
  await page.getByRole("button", { name: "Templates", exact: true }).click();
  await page
    .getByRole("button", { name: /Research to brief.*7 nodes/ })
    .click();
  await page.getByRole("button", { name: "Run workflow", exact: true }).click();
  await page.getByRole("button", { name: "Stop run", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Run stopped." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Resume from checkpoint" }).click();
  await expect(
    page.getByRole("dialog", { name: "Confirm action retry" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep stopped" }).click();
  await expect(
    page.getByRole("dialog", { name: "Confirm action retry" }),
  ).not.toBeVisible();
});

test("JSON emitted as text is presented as readable fields with a raw view", async ({
  page,
  request,
}) => {
  const { blank } = await import("../../shared/templates");
  const workflow = {
    ...blank,
    id: "structured-output-test",
    name: "Structured output test",
  };
  const response = await request.post("/api/runs", {
    data: {
      workflow,
      mode: "demo",
      input: JSON.stringify({
        summary: "A clear diagnosis.",
        suggested_reply: "Please share the **request ID**.",
        next_step: "Inspect the export logs.",
      }),
    },
  });
  const run = await response.json();
  await expect
    .poll(
      async () =>
        (await (await request.get(`/api/runs/${run.id}`)).json()).status,
    )
    .toBe("completed");
  await page.goto("/#editor");
  await expect(page.getByText("Local engine connected")).toBeVisible();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Run history", exact: true })
    .click();
  await page
    .locator(".history-list>button")
    .filter({ hasText: "Structured output test" })
    .click();
  await page.getByRole("button", { name: "Read final output" }).click();
  const dialog = page.getByRole("dialog", { name: "Workflow output" });
  await expect(dialog.locator(".result-field")).toHaveCount(3);
  await expect(
    dialog.getByRole("heading", { name: "suggested reply" }),
  ).toBeVisible();
  await expect(dialog.locator("strong")).toHaveText("request ID");
  await dialog.getByRole("button", { name: "View output source" }).click();
  await expect(dialog.locator(".result-view>pre")).toContainText(
    "suggested_reply",
  );
});
