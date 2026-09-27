import { test, expect } from "@playwright/test";
import { groceryCart } from "../../shared/templates";
import type { BrowserLogin } from "../../shared/browser-login";

test("Home CUA sign-in shows handoff, survives reload, and unlocks the workflow after confirmation", async ({
  page,
  request,
}) => {
  const workflow = { ...groceryCart, id: "login-home-fixture" };
  await request.put(`/api/workflows/${workflow.id}`, { data: workflow });
  let session: BrowserLogin | null = null;
  let requestedInput: unknown;
  await page.route("**/api/browser/logins", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      expect(body.workflowId).toBe(workflow.id);
      expect(body.nodeId).toBe("shop");
      requestedInput = body.input;
      session = {
        id: "login-fixture",
        workflowId: workflow.id,
        nodeId: "shop",
        status: "waiting",
        message: "Your turn. Complete sign-in in Chrome.",
      };
      return route.fulfill({ json: session });
    }
    return route.fulfill({
      json: session?.status === "waiting" ? [session] : [],
    });
  });
  await page.route("**/api/browser/logins/login-fixture", (route) =>
    route.fulfill({ json: session }),
  );
  await page.route("**/api/browser/logins/login-fixture/finish", (route) => {
    session = {
      ...session!,
      status: "completed",
      message:
        "Browser session saved. You confirmed sign-in; the website will verify access when the workflow runs.",
    };
    return route.fulfill({ json: session });
  });
  await page.goto("/");
  await page.getByLabel("Choose workflow for chat").selectOption(workflow.id);
  await page
    .getByLabel("Message Jeeves", { exact: true })
    .fill("Prepare groceries after I sign in");
  await page.getByRole("button", { name: "Send to Jeeves" }).click();
  await page
    .getByRole("button", { name: "Use CUA to sign in", exact: true })
    .click();
  expect(requestedInput).toMatchObject({ budget: 15 });
  await expect(
    page.getByRole("button", { name: "Run demo", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "I’m signed in", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "I’m signed in", exact: true })
    .click();
  await expect(
    page.getByText(/Browser session saved. You confirmed sign-in/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Run demo", exact: true }),
  ).toBeEnabled();
});
test("browser editor offers CUA and manual sign-in with recoverable CUA errors", async ({
  page,
  request,
}) => {
  const workflow = { ...groceryCart, id: "login-editor-fixture" };
  await request.put(`/api/workflows/${workflow.id}`, { data: workflow });
  await page.addInitScript(
    (id) => localStorage.setItem("jeeves-workflow", id),
    workflow.id,
  );
  await page.route("**/api/browser/logins", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 400,
          json: {
            error:
              "Allow the store website in Settings before opening this browser task.",
          },
        })
      : route.fulfill({ json: [] }),
  );
  await page.goto("/#editor");
  await page
    .locator(".flow-node")
    .filter({ hasText: "Prepare grocery cart" })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Open workflow browser for login or review",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Use CUA to sign in", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Allow the store website",
  );
  await expect(
    page.getByRole("button", { name: "Use CUA to sign in", exact: true }),
  ).toBeEnabled();
});
