import { test, expect } from "@playwright/test";
import { blank, groceryCart } from "../../shared/templates";
import { makeNode } from "../../shared/schema";
import { simulationServer } from "../fixtures/simulation-server";
let fixture: Awaited<ReturnType<typeof simulationServer>>;
test.beforeAll(async () => {
  fixture = await simulationServer();
});
test.afterAll(async () => fixture.close());
// These journeys start in the workspace. Cover the welcome screen separately
// in onboarding.spec.ts and first-workflow.spec.ts, without relying on a chat
// created by another test to suppress it.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("jeeves-setup:v1", "done"),
  );
});
test("user can edit a task and run it without writing JSON", async ({
  page,
  request,
}) => {
  const workflow = {
    ...blank,
    id: "persona-first-use",
    name: "First task",
    input: '{"task":"Try a task","budget":15,"approved":false}',
  };
  await request.put("/api/workflows/" + workflow.id, { data: workflow });
  await page.goto("/");
  await page.getByLabel("Choose workflow for chat").selectOption(workflow.id);
  await page
    .getByLabel("Message Jeeves", { exact: true })
    .fill("Prepare my first task");
  await page.getByRole("button", { name: "Send to Jeeves" }).click();
  await page
    .getByLabel("Task input: task", { exact: true })
    .fill("My first useful result");
  await page.getByLabel("Task input: budget", { exact: true }).fill("12");
  await page.getByRole("button", { name: "Run demo", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Chat run result" }),
  ).toContainText("My first useful result", { timeout: 15000 });
  await expect(
    page.getByRole("region", { name: "Chat run result" }),
  ).toContainText("12");
});
test("maintainer can configure website access and scoped credentials through Settings", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByLabel("Allowed websites", { exact: true })
    .fill(fixture.origin);
  await page
    .getByRole("button", { name: "Save website access", exact: true })
    .click();
  await expect(
    page.getByText("Saved on this device.", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Credential name", { exact: true })
    .fill("GITHUB_TOKEN");
  await page
    .getByLabel("Credential website", { exact: true })
    .fill(fixture.origin);
  await page
    .getByLabel("API credential token", { exact: true })
    .fill("fixture-maintainer-token");
  await page
    .getByRole("button", { name: "Save credential", exact: true })
    .click();
  await expect(
    page.getByLabel("API credential token", { exact: true }),
  ).toHaveValue("");
  const settings = await (await request.get("/api/integrations")).text();
  expect(settings).not.toContain("fixture-maintainer-token");
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    "fixture-maintainer-token",
  );
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.locator(".integration-secret")).toContainText(
    "GITHUB_TOKEN",
  );
});
test("maintainer runs an authenticated GitHub-shaped read from Home", async ({
  page,
  request,
}) => {
  const workflow = {
    ...blank,
    id: "persona-maintainer-read",
    name: "Read maintainer issues",
    input: '{"owner":"acme","repo":"project"}',
    nodes: [
      makeNode("input", "input", 0, 0),
      makeNode("action", "issues", 300, 0, {
        url: fixture.origin + "/repos/{{input.owner}}/{{input.repo}}/issues",
        authEnv: "GITHUB_TOKEN",
      }),
      makeNode("output", "output", 600, 0),
    ],
    edges: [
      { id: "a", source: "input", target: "issues" },
      { id: "b", source: "issues", target: "output" },
    ],
  };
  await request.put("/api/workflows/" + workflow.id, { data: workflow });
  await page.goto("/");
  await page.getByLabel("Choose workflow for chat").selectOption(workflow.id);
  await page.getByLabel("Chat run mode").selectOption("live");
  await page
    .getByLabel("Message Jeeves", { exact: true })
    .fill("Read maintainer issues");
  await page.getByRole("button", { name: "Send to Jeeves" }).click();
  await page.getByRole("button", { name: "Run live", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your result is ready." }),
  ).toBeVisible({ timeout: 15000 });
  const id = await page.evaluate(() => localStorage.getItem("jeeves-chat"));
  const chat = await (await request.get("/api/chats/" + id)).json();
  const run = await (await request.get("/api/runs/" + chat.runIds[0])).json();
  expect(run.nodes.output.output[0].number).toBe(12);
});
test("shopper can discover a browser starter and simulate without touching the shop", async ({
  page,
  request,
}) => {
  await request.put("/api/workflows/" + groceryCart.id, { data: groceryCart });
  await page.goto("/#explore");
  await expect(
    page
      .locator(".market-workflow-card")
      .filter({ hasText: "Grocery cart preparation" }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Home", exact: true })
    .click();
  await page
    .getByLabel("Choose workflow for chat")
    .selectOption(groceryCart.id);
  await page.getByLabel("Chat run mode").selectOption("demo");
  await page
    .getByLabel("Message Jeeves", { exact: true })
    .fill("Prepare a grocery cart");
  await page.getByRole("button", { name: "Send to Jeeves" }).click();
  await page.getByRole("button", { name: "Run demo", exact: true }).click();
  const form = page.getByRole("form", { name: "Your grocery trip" });
  await form.getByLabel("Groceries and quantities").fill("2 cartons oat milk");
  await form.getByLabel("Delivery ZIP code", { exact: true }).fill("02139");
  await form.getByRole("button", { name: "Submit & continue" }).click();
  await expect(
    page.getByRole("region", { name: "Chat run result" }),
  ).toContainText("no browser was opened", { timeout: 15000 });
});
test("workflow designer can add a browser task and see its execution requirements", async ({
  page,
  request,
}) => {
  await request.put("/api/workflows/persona-browser-designer", {
    data: { ...blank, id: "persona-browser-designer" },
  });
  await page.addInitScript(() =>
    localStorage.setItem("jeeves-workflow", "persona-browser-designer"),
  );
  await page.goto("/#editor");
  await page.getByRole("button", { name: "Add node", exact: true }).click();
  await page
    .getByRole("button", { name: /Browser task Give an agent/ })
    .click();
  await page
    .getByLabel("Starting website", { exact: true })
    .fill(fixture.origin + "/shop");
  await page
    .getByLabel("Browser access", { exact: true })
    .selectOption("interact");
  await expect(
    page.getByRole("button", {
      name: "Open workflow browser for login or review",
    }),
  ).toBeVisible();
  await expect(page.getByText(/Codex sees screenshots/)).toBeVisible();
});
test("advanced user gets actionable feedback for malformed JSON without launching a run", async ({
  page,
  request,
}) => {
  await request.put("/api/workflows/persona-json", {
    data: { ...blank, id: "persona-json" },
  });
  await page.goto("/");
  await page
    .getByLabel("Choose workflow for chat")
    .selectOption("persona-json");
  await page.getByLabel("Message Jeeves", { exact: true }).fill("Try input");
  await page.getByRole("button", { name: "Send to Jeeves" }).click();
  await page.getByRole("button", { name: "Edit JSON", exact: true }).click();
  await page.getByLabel("Workflow input for chat run").fill("{broken");
  await page.getByRole("button", { name: "Run demo", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Check quotes and commas",
  );
  await expect(
    page.getByRole("region", { name: "Chat run result" }),
  ).toHaveCount(0);
});

test("blocked live run becomes ready after website setup without losing edited task fields", async ({
  page,
  request,
}) => {
  await request.put("/api/integrations", { data: { origins: [] } });
  const w = {
    ...blank,
    id: "persona-access-setup",
    name: "Setup journey",
    nodes: [
      makeNode("input", "input", 0, 0),
      makeNode("action", "request", 300, 0, { url: fixture.origin + "/echo" }),
      makeNode("output", "output", 600, 0),
    ],
    edges: [
      { id: "a", source: "input", target: "request" },
      { id: "b", source: "request", target: "output" },
    ],
  };
  await request.put("/api/workflows/" + w.id, { data: w });
  await page.goto("/");
  await page.getByLabel("Choose workflow for chat").selectOption(w.id);
  await page.getByLabel("Chat run mode").selectOption("live");
  await page
    .getByLabel("Message Jeeves", { exact: true })
    .fill("Set up my action");
  await page.getByRole("button", { name: "Send to Jeeves" }).click();
  await page
    .getByLabel("Task input: task", { exact: true })
    .fill("Keep this edited task");
  await expect(
    page.getByRole("button", { name: "Run live", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Open settings", exact: true })
    .click();
  await page
    .getByLabel("Allowed websites", { exact: true })
    .fill(fixture.origin);
  await page
    .getByRole("button", { name: "Save website access", exact: true })
    .click();
  await expect(
    page.getByText("Saved on this device.", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Run live", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByLabel("Task input: task", { exact: true }),
  ).toHaveValue("Keep this edited task");
});

test("user can follow page links and go back without reloading the workspace", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Message Jeeves", { exact: true }).waitFor();
  await page.goto("/#explore");
  await expect(
    page
      .locator(".market-workflow-card")
      .filter({ hasText: "Grocery cart preparation" }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Home", exact: true })
    .click();
  await expect(
    page.getByLabel("Message Jeeves", { exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page
      .locator(".market-workflow-card")
      .filter({ hasText: "GitHub maintenance" }),
  ).toBeVisible();
});
