import { test, expect } from "@playwright/test";
import { blank } from "../../shared/templates";
test("home chat prepares, runs, persists, and protects against duplicate execution", async ({
  page,
  request,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("jeeves-setup:v1", "done"),
  );
  await request.put(`/api/workflows/${blank.id}`, { data: blank });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Turn repeat work into a workflow." }),
  ).toBeVisible();
  await page.getByLabel("Choose workflow for chat").selectOption(blank.id);
  await page
    .getByLabel("Message Jeeves", { exact: true })
    .fill("A harmless chat fixture");
  await page.getByRole("button", { name: "Send to Jeeves" }).click();
  await expect(
    page.getByRole("region", { name: "Workflow run preview" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit JSON", exact: true }).click();
  await page
    .getByLabel("Workflow input for chat run")
    .fill('{"task":"Original chat input"}');
  await page.getByRole("button", { name: "Run demo", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your result is ready." }),
  ).toBeVisible({ timeout: 10000 });
  const chatId = await page.evaluate(() => localStorage.getItem("jeeves-chat"));
  const session = await (await request.get(`/api/chats/${chatId}`)).json();
  const repeat = await request.post(`/api/chats/${chatId}/run`, {
    data: {
      revision: session.revision,
      mode: "demo",
      input: { task: "Changed after execution" },
    },
  });
  expect((await repeat.json()).id).toBe(session.runIds[0]);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your result is ready." }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Chat run result" }),
  ).toContainText("Original chat input");
  const workflowsBeforeInspect = await (
    await request.get("/api/workflows")
  ).json();
  await page.getByRole("button", { name: "Inspect run", exact: false }).click();
  await expect(
    page.getByRole("heading", { name: "Everything connected." }),
  ).toBeVisible();
  await expect(
    page.getByText("Run snapshot · edits save a copy", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Workflows", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open Research to brief", exact: true })
    .click();
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  const workflowsAfterInspect = await (
    await request.get("/api/workflows")
  ).json();
  expect(workflowsAfterInspect.length).toBe(workflowsBeforeInspect.length);
});
test("Explore previews a workflow and installs a local copy without running it", async ({
  page,
  request,
}) => {
  const before = (await (await request.get("/api/runs")).json()).length;
  await page.goto("/#explore");
  await page
    .locator(".market-workflow-card")
    .filter({ hasText: "Draft & review" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Workflow marketplace preview" }),
  ).toBeVisible();
  await page.getByLabel("Agent provider for your copy").selectOption("codex");
  await page
    .getByRole("button", { name: "Add to my library", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Added to your local library",
  );
  expect((await (await request.get("/api/runs")).json()).length).toBe(before);
  await page
    .getByRole("button", { name: "Open workflow", exact: true })
    .click();
  await expect(page.getByLabel("Workflow name", { exact: true })).toHaveValue(
    "Draft & review · copy 2",
  );
});
test("portable skill and contribution export require review and download actual bundles", async ({
  page,
  request,
}) => {
  await page.goto("/#editor");
  await expect(page.getByText("Local engine connected")).toBeVisible();
  await page
    .getByRole("button", { name: "Share or export", exact: true })
    .click();
  await page
    .getByLabel("Workflow to share", { exact: true })
    .selectOption(blank.id);
  await page.getByRole("button", { name: "Prepare export preview" }).click();
  await expect(
    page.getByRole("button", { name: "Download skill", exact: true }),
  ).toBeDisabled();
  await page.getByRole("checkbox", { name: /I reviewed the included/ }).check();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download skill", exact: true })
    .click();
  expect((await download).suggestedFilename()).toMatch(/-skill.zip$/);
  await page
    .getByRole("button", { name: /Marketplace contribution Share/ })
    .click();
  const contribution = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download contribution", exact: true })
    .click();
  expect((await contribution).suggestedFilename()).toMatch(
    /-contribution.zip$/,
  );
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Share workflow" }),
  ).not.toBeVisible();
});
