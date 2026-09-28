import { test, expect } from "@playwright/test";
import { blank } from "../../shared/templates";

test("refinement preserves edited task and marks previous output; a different task replaces it", async ({
  page,
  request,
}) => {
  const workflow = {
    ...blank,
    id: "study-chat-regression",
    name: "Study writing",
    input: '{"task":"Example"}',
  };
  await request.put(`/api/workflows/${workflow.id}`, { data: workflow });
  await page.goto("/");
  await page.getByLabel("Choose workflow for chat").selectOption(workflow.id);
  await page
    .getByLabel("Message Jeeves", { exact: true })
    .fill("Invite volunteers at 9am");
  await page.getByRole("button", { name: "Send to Jeeves" }).click();
  await page
    .getByLabel("Task input: task", { exact: true })
    .fill("Invite volunteers at 10am. Bring gloves.");
  await page.getByRole("button", { name: "Run demo", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your result is ready." }),
  ).toBeVisible();
  await page
    .getByLabel("Message Jeeves", { exact: true })
    .fill("Make it shorter");
  await page.getByRole("button", { name: "Send to Jeeves" }).click();
  await expect(
    page.getByLabel("Task input: task", { exact: true }),
  ).toHaveValue(
    "Invite volunteers at 10am. Bring gloves.\n\nUpdate:\nMake it shorter",
  );
  await expect(
    page.getByRole("heading", { name: "Study writing", exact: true }),
  ).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "Workspace preferences", exact: true }),
  ).toBeInViewport();
  await expect(
    page.getByText("PREVIOUS DEMO RUN", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("This run used an earlier version of your task.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Run demo", exact: true }).click();
  await expect(
    page.getByText("PREVIOUS DEMO RUN", { exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Message intent").selectOption("new");
  await page
    .getByLabel("Message Jeeves", { exact: true })
    .fill("Write a birthday card");
  await page.getByRole("button", { name: "Send to Jeeves" }).click();
  await expect(
    page.getByLabel("Task input: task", { exact: true }),
  ).toHaveValue("Write a birthday card");
});

test("laptop preview keeps install and open actions visible, and repeated imports have distinct names", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 960, height: 700 });
  await page.goto("/#explore");
  await page
    .locator(".market-workflow-card")
    .filter({ hasText: "Draft & review" })
    .click();
  const install = page.getByRole("button", {
    name: "Add to my library",
    exact: true,
  });
  await expect(install).toBeInViewport();
  await install.click();
  const open = page.getByRole("button", { name: "Open workflow", exact: true });
  await expect(open).toBeInViewport();
  const before = await (await request.get("/api/workflows")).json();
  await page.keyboard.press("Escape");
  await page
    .locator(".market-workflow-card")
    .filter({ hasText: "Draft & review" })
    .click();
  await install.click();
  await expect(open).toBeInViewport();
  const after = await (await request.get("/api/workflows")).json();
  const added = after.filter(
    (w: any) => !before.some((x: any) => x.id === w.id),
  );
  expect(added).toHaveLength(1);
  expect(before.some((w: any) => w.name === added[0].name)).toBe(false);
});
