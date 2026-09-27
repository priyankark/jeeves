import { test, expect } from "@playwright/test";
import { blank } from "../../shared/templates";

test("creates a recurring schedule, previews local times, pauses, edits and deletes it", async ({
  page,
}) => {
  await page.goto("/#editor");
  await expect(page.getByText("Local engine connected")).toBeVisible();
  await page.getByRole("button", { name: "Schedules", exact: true }).click();
  await page.getByRole("button", { name: "New schedule", exact: true }).click();
  await page
    .getByLabel("Schedule name", { exact: true })
    .fill("Weekday browser test");
  await page.getByLabel("Time zone", { exact: true }).fill("America/New_York");
  await page
    .getByRole("button", { name: "Preview upcoming runs", exact: true })
    .click();
  await expect(page.locator(".schedule-preview li")).toHaveCount(5);
  await page
    .getByRole("button", { name: "Create schedule", exact: true })
    .click();
  const card = page
    .locator(".schedule-card")
    .filter({ hasText: "Weekday browser test" });
  await expect(card).toContainText("Active");
  await card.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(card).toContainText("Paused");
  await card.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByLabel("Schedule name", { exact: true })
    .fill("Updated schedule");
  await page
    .getByRole("button", { name: "Save schedule", exact: true })
    .click();
  await page.reload();
  await page.getByRole("button", { name: "Schedules", exact: true }).click();
  const updated = page
    .locator(".schedule-card")
    .filter({ hasText: "Updated schedule" });
  await expect(updated).toContainText("Paused");
  await updated
    .getByRole("button", { name: "Delete Updated schedule", exact: true })
    .click();
  await updated
    .getByRole("button", { name: "Delete schedule", exact: true })
    .click();
  await expect(updated).toHaveCount(0);
});

test("a due one-time schedule executes and opens its actual run", async ({
  page,
  request,
}) => {
  const response = await request.post("/api/schedules", {
    data: {
      name: "Scheduled browser run",
      workflow: blank,
      mode: "demo",
      input: '{"task":"scheduled fixture"}',
      kind: "once",
      timezone: "UTC",
      at: new Date(Date.now() + 2000).toISOString(),
      missed: "once",
    },
  });
  expect(response.status()).toBe(201);
  const created = await response.json();
  await page.goto("/#editor");
  await page.getByRole("button", { name: "Schedules", exact: true }).click();
  const card = page
    .locator(".schedule-card")
    .filter({ hasText: "Scheduled browser run" });
  await expect(card).toContainText("Last run completed", { timeout: 15000 });
  await card
    .getByRole("button", { name: "View last run →", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Everything connected." }),
  ).toBeVisible();
  const list = await (await request.get("/api/runs")).json();
  const run = list.find(
    (r: { scheduleId: string }) => r.scheduleId === created.id,
  );
  expect(run.status).toBe("completed");
  expect(run.input.task).toBe("scheduled fixture");
  await request.delete(`/api/schedules/${created.id}`);
});

test("marketplace preview, install, workflow assignment and uninstall are usable", async ({
  page,
}) => {
  const commit = "b".repeat(40);
  const skill = {
    id: "fixture-marketplace",
    name: "review-writing",
    description: "A focused writing checklist.",
    repo: "example/skills",
    path: "skills/review-writing",
    commit,
    installedAt: new Date().toISOString(),
    fileCount: 1,
    hasScripts: false,
  };
  let installed = false;
  await page.route("**/api/skills", (route) =>
    route.fulfill({ json: installed ? [skill] : [] }),
  );
  await page.route("**/api/marketplace?*", (route) =>
    route.fulfill({
      json: {
        repo: "example/skills",
        commit,
        skills: [{ name: skill.name, path: skill.path }],
      },
    }),
  );
  await page.route("**/api/skills/preview", (route) =>
    route.fulfill({
      json: {
        ...skill,
        instructions: "# Writing checklist\nCheck evidence before reporting.",
        files: ["SKILL.md"],
      },
    }),
  );
  await page.route("**/api/skills/install", async (route) => {
    expect(route.request().postDataJSON().commit).toBe(commit);
    installed = true;
    await route.fulfill({ json: skill });
  });
  await page.route("**/api/skills/fixture-marketplace", async (route) => {
    installed = false;
    await route.fulfill({ json: { deleted: true } });
  });
  await page.goto("/#editor");
  await expect(page.getByText("Local engine connected")).toBeVisible();
  await page.getByRole("button", { name: "Skills", exact: true }).click();
  await page.getByRole("button", { name: "Marketplace", exact: true }).click();
  await page.getByLabel("Search marketplace").fill("review");
  await page.locator(".marketplace-grid button").click();
  await expect(
    page.getByText("Check evidence before reporting.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Install reviewed version", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "review-writing installed",
  );
  await page
    .getByRole("button", { name: "Installed (1)", exact: true })
    .click();
  await page.getByRole("checkbox", { name: /review-writing/ }).check();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await expect(page.getByText("Saved locally")).toBeVisible();
  await page.getByRole("button", { name: "Skills", exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: /review-writing/ }),
  ).toBeChecked();
  await page
    .getByRole("button", { name: "Uninstall review-writing", exact: true })
    .click();
  const saved = page.waitForResponse(
    (r) =>
      r.url().includes("/api/workflows/") &&
      r.request().method() === "PUT" &&
      r.request().postDataJSON().skillIds.length === 0,
  );
  await page.getByRole("button", { name: "Uninstall", exact: true }).click();
  await saved;
  await expect(
    page.getByRole("button", { name: "Installed (0)", exact: true }),
  ).toBeVisible();
});
