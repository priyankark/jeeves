import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { blank } from "../../shared/templates";
import { makeNode } from "../../shared/schema";
const server = createServer((_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ message: "Website access works" }));
});
let origin: string;
test.beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
const workflow = () => ({
  ...blank,
  id: "website-permission-test",
  name: "Website permission test",
  nodes: [
    makeNode("input", "input", 0, 0),
    makeNode("action", "read", 330, 0, { url: origin + "/project" }),
    makeNode("output", "output", 660, 0),
  ],
  edges: [
    { id: "in", source: "input", target: "read" },
    { id: "out", source: "read", target: "output" },
  ],
});
test.beforeEach(async ({ request }) => {
  await request.put("/api/integrations", {
    data: { origins: [], allowAllWebsites: false },
  });
  await request.put("/api/workflows/website-permission-test", {
    data: workflow(),
  });
});
test("a blocked run can allow all websites, retry, and switch back to the allowlist", async ({
  page,
  request,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("jeeves-workflow", "website-permission-test"),
  );
  await page.goto("/#editor");
  await page.getByLabel("Run mode", { exact: true }).selectOption("live");
  await page.getByRole("button", { name: "Run workflow", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A step needs attention." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Allow all websites & APIs", exact: true })
    .click();
  await expect(
    page.getByText("Website access saved. Retry the run when ready."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Retry from checkpoint", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Everything connected." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "A workflow needs attention",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const checkbox = page.getByRole("checkbox", {
    name: /Allow all websites & APIs/,
  });
  await expect(checkbox).toBeChecked();
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(checkbox).toBeChecked();
  await checkbox.uncheck();
  await expect
    .poll(
      async () =>
        (await (await request.get("/api/integrations")).json())
          .allowAllWebsites,
    )
    .toBe(false);
  await expect(
    page.getByLabel("Allowed websites", { exact: true }),
  ).toBeEnabled();
});
test("Home can allow only the required website and immediately unblock its preview", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page.getByLabel("Chat run mode").selectOption("live");
  await page
    .getByLabel("Choose workflow for chat")
    .selectOption("website-permission-test");
  await page
    .getByLabel("Message Jeeves", { exact: true })
    .fill("Read the project metadata");
  await page.getByRole("button", { name: "Send to Jeeves" }).click();
  await expect(
    page.getByRole("button", { name: "Run live", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: `Allow ${origin}`, exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Run live", exact: true }),
  ).toBeEnabled();
  const settings = await (await request.get("/api/integrations")).json();
  expect(settings.origins).toContain(origin);
  expect(settings.allowAllWebsites).toBe(false);
  await page.getByRole("button", { name: "Run live", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your result is ready." }),
  ).toBeVisible();
});

test("saved-browser permission errors offer inline access and retry without opening Settings", async ({
  page,
  request,
}) => {
  const browserWorkflow = workflow();
  browserWorkflow.nodes[1] = makeNode("browser", "read", 330, 0, {
    label: "Review store",
    url: origin,
  });
  await request.put(`/api/workflows/${browserWorkflow.id}`, {
    data: browserWorkflow,
  });
  await page.addInitScript(() =>
    localStorage.setItem("jeeves-workflow", "website-permission-test"),
  );
  await page.route("**/api/runs", (route) =>
    route.fulfill({
      json: {
        id: "browser-review-fixture",
        workflowId: browserWorkflow.id,
        workflowName: browserWorkflow.name,
        workflow: browserWorkflow,
        mode: "live",
        status: "completed",
        startedAt: new Date().toISOString(),
        nodes: Object.fromEntries(
          browserWorkflow.nodes.map((n) => [
            n.id,
            { status: "completed", startedAt: new Date().toISOString() },
          ]),
        ),
        events: [],
      },
    }),
  );
  let attempts = 0;
  await page.route(
    "**/api/runs/browser-review-fixture/browser/read/open",
    (route) => {
      attempts++;
      return attempts === 1
        ? route.fulfill({
            status: 400,
            json: {
              error: `Allow ${origin} in Settings → Websites & API access before opening this browser task.`,
            },
          })
        : route.fulfill({ json: { opened: true } });
    },
  );
  await page.goto("/#editor");
  await page.getByLabel("Run mode", { exact: true }).selectOption("demo");
  await page.getByRole("button", { name: "Run workflow", exact: true }).click();
  await page
    .getByRole("button", { name: "Review browser · Review store", exact: true })
    .click();
  const recovery = page.getByRole("region", { name: "Saved browser sessions" });
  await expect(
    recovery.getByRole("button", { name: `Allow ${origin}`, exact: true }),
  ).toBeVisible();
  await recovery
    .getByRole("button", { name: "Allow all websites & APIs", exact: true })
    .click();
  await expect(
    recovery.getByRole("button", { name: "Open browser again", exact: true }),
  ).toBeVisible();
  expect(attempts).toBe(1);
  expect(
    (await (await request.get("/api/integrations")).json()).allowAllWebsites,
  ).toBe(true);
  await recovery
    .getByRole("button", { name: "Open browser again", exact: true })
    .click();
  await expect(recovery.getByRole("status")).toContainText(
    "Browser opened with the saved session",
  );
  expect(attempts).toBe(2);
});
