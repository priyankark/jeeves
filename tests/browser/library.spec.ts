import { test, expect } from "@playwright/test";
import { groceryCart, githubTriage } from "../../shared/templates";
test("Workflows opens the saved library, with search, explicit opening, and back navigation", async ({
  page,
  request,
}) => {
  for (const workflow of [groceryCart, githubTriage])
    await request.put(`/api/workflows/${workflow.id}`, { data: workflow });
  await page.goto("/#editor");
  await page
    .locator(".sidebar")
    .getByRole("button", { name: /^Workflows/ })
    .click();
  await expect(page).toHaveURL(/#workflows$/);
  const library = page.getByRole("main", { name: "Workflow library" });
  await expect(
    library.getByRole("heading", { name: "Workflows", exact: true }),
  ).toBeVisible();
  await expect(
    library.getByRole("button", {
      name: "Open GitHub maintenance",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    library.getByRole("button", {
      name: "Open Grocery cart preparation",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Workflow name", { exact: true }),
  ).not.toBeVisible();
  await page.reload();
  await expect(library).toBeVisible();
  await page.getByLabel("Search saved workflows").fill("grocery");
  await expect(
    library.getByRole("button", {
      name: "Open GitHub maintenance",
      exact: true,
    }),
  ).toHaveCount(0);
  await library
    .getByRole("button", { name: "Open Grocery cart preparation", exact: true })
    .click();
  await expect(page.getByLabel("Workflow name", { exact: true })).toHaveValue(
    "Grocery cart preparation",
  );
  await page.goBack();
  await expect(library).toBeVisible();
  await library
    .getByRole("button", { name: "Open GitHub maintenance", exact: true })
    .click();
  await page
    .locator(".breadcrumbs")
    .getByRole("button", { name: "Workflows", exact: true })
    .click();
  await expect(library).toBeVisible();
  await page
    .getByLabel("Search saved workflows")
    .fill("No matching workflow xyz");
  await expect(
    library.getByRole("heading", { name: "No matching workflows" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await expect(
    library.getByRole("button", {
      name: "Open GitHub maintenance",
      exact: true,
    }),
  ).toBeVisible();
});
