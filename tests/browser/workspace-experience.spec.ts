import { test, expect } from "@playwright/test";
import { groceryCart } from "../../shared/templates";
import type { BrowserLogin } from "../../shared/browser-login";

const workflow = {
  ...groceryCart,
  id: "experience-fixture",
  name: "Amazon shopping · usability fixture",
};
test.beforeEach(async ({ page, request }) => {
  await request.put(`/api/workflows/${workflow.id}`, { data: workflow });
  await page.addInitScript(
    (id) => localStorage.setItem("jeeves-workflow", id),
    workflow.id,
  );
});

test("navigation collapses independently and persists; full-screen editing restores without losing input", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/#editor");
  const canvas = page.getByRole("region", { name: "Workflow canvas" });
  const before = (await canvas.boundingBox())!.width;
  await page
    .getByRole("button", { name: "Collapse workspace sidebar", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Hide navigation rail", exact: true })
    .click();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeHidden();
  expect((await canvas.boundingBox())!.width).toBeGreaterThan(before + 200);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Show workspace sidebar", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeHidden();
  await page.locator(".flow-node.browser").click();
  await page
    .getByRole("button", { name: "Expand panel to full screen" })
    .click();
  const expanded = page.getByRole("dialog", {
    name: "Expanded workspace panel",
  });
  await expect(expanded).toBeVisible();
  expect((await expanded.boundingBox())!.width).toBe(1366);
  const instructions = expanded.getByRole("textbox", {
    name: "Instructions",
    exact: true,
  });
  await instructions.fill(
    "Keep my cart intact and stop before checkout. This edit must survive resizing.",
  );
  await page.setViewportSize({ width: 1100, height: 760 });
  expect(
    await expanded.evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await instructions.press("Escape");
  await expect(expanded).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Instructions", exact: true }),
  ).toHaveValue(/This edit must survive/);
  await expect(
    page.getByRole("button", { name: "Expand panel to full screen" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Focus canvas", exact: true }).click();
  await expect(
    page.getByRole("complementary", { name: "Workspace panel" }),
  ).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Activity", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Exit focus", exact: true }).click();
  await expect(
    page.getByRole("complementary", { name: "Workspace panel" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeHidden();
  await page
    .getByRole("button", { name: "Show navigation rail", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Show workspace sidebar", exact: true })
    .click();
  await expect(
    page.getByRole("complementary", { name: "Workspace sidebar" }),
  ).toBeVisible();
});

test("login handoff reaches Activity away from the inspector, chimes once, and navigates back to the right step", async ({
  page,
}) => {
  let state: BrowserLogin["status"] = "working";
  let started = false;
  const session = (): BrowserLogin => ({
    id: "attention-login",
    workflowId: workflow.id,
    nodeId: "shop",
    status: state,
    message:
      state === "waiting"
        ? "Your turn. Complete sign-in in Chrome."
        : "Finding sign-in.",
  });
  await page.addInitScript(() => {
    localStorage.setItem(
      "jeeves-notifications",
      JSON.stringify({ sound: true, desktop: false }),
    );
    (window as any).chimes = 0;
    (window as any).AudioContext = class {
      currentTime = 0;
      destination = {};
      resume() {
        return Promise.resolve();
      }
      createOscillator() {
        return {
          frequency: { value: 0 },
          connect() {},
          disconnect() {},
          start() {
            (window as any).chimes++;
          },
          stop() {},
        };
      }
      createGain() {
        return {
          gain: {
            setValueAtTime() {},
            linearRampToValueAtTime() {},
            exponentialRampToValueAtTime() {},
          },
          connect() {},
          disconnect() {},
        };
      }
    };
  });
  await page.route("**/api/browser/logins", (route) => {
    if (route.request().method() === "POST") {
      started = true;
      return route.fulfill({ json: session() });
    }
    return route.fulfill({
      json:
        started && ["working", "waiting"].includes(state) ? [session()] : [],
    });
  });
  await page.route("**/api/browser/logins/attention-login", (route) =>
    route.fulfill({ json: session() }),
  );
  await page.route("**/api/browser/logins/attention-login/finish", (route) => {
    state = "completed";
    return route.fulfill({ json: session() });
  });
  await page.goto("/#editor");
  await page.locator(".flow-node.browser").click();
  await page
    .getByRole("button", { name: "Use CUA to sign in", exact: true })
    .click();
  await page.getByRole("button", { name: "Close workspace panel" }).click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Home", exact: true })
    .click();
  state = "waiting";
  await expect(
    page.getByRole("button", { name: "Your browser needs you", exact: true }),
  ).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).chimes)).toBe(2);
  await page.waitForTimeout(3300);
  expect(await page.evaluate(() => (window as any).chimes)).toBe(2);
  await page.getByRole("button", { name: /Activity, 1 unread/ }).click();
  const activity = page.getByRole("dialog", { name: "Activity", exact: true });
  await expect(activity).toContainText(workflow.name);
  await activity.getByRole("button", { name: "Review sign-in" }).click();
  await expect(
    page.getByRole("button", { name: "I’m signed in", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Expand panel to full screen" })
    .click();
  await page
    .getByRole("dialog", { name: "Expanded workspace panel" })
    .getByRole("button", { name: "Activity", exact: true })
    .click();
  await expect(activity).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(activity).toBeHidden();
  await expect(
    page.getByRole("dialog", { name: "Expanded workspace panel" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "I’m signed in", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Your browser needs you", exact: true }),
  ).toBeHidden();
});

test("notification preferences are opt-in, persist, and handle a denied desktop permission", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).Notification = class {
      static permission = "denied";
      static requestPermission() {
        return Promise.resolve("denied");
      }
    };
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Workspace preferences", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: /Play a gentle sound/ }),
  ).not.toBeChecked();
  await page.getByRole("checkbox", { name: /Play a gentle sound/ }).check();
  await page.getByRole("checkbox", { name: /Desktop notifications/ }).click();
  await expect(page.getByRole("status")).toContainText(
    "Desktop alerts were not allowed",
  );
  await expect(
    page.getByRole("checkbox", { name: /Desktop notifications/ }),
  ).not.toBeChecked();
  await page.reload();
  await page
    .getByRole("button", { name: "Workspace preferences", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: /Play a gentle sound/ }),
  ).toBeChecked();
});

test("raw browser failures become actionable errors without overflowing the inspector", async ({
  page,
}) => {
  await page.route("**/api/browser/logins", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 400,
          json: {
            error:
              "locator.click: Timeout 8000ms exceeded.\nCall log:\n\u001b[2moverlay intercepts pointer events\u001b[22m\n" +
              "long-internal-locator".repeat(100),
          },
        })
      : route.fulfill({ json: [] }),
  );
  await page.goto("/#editor");
  await page.locator(".flow-node.browser").click();
  await page
    .getByRole("button", { name: "Use CUA to sign in", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Something on the website is covering that control",
  );
  const details = page.locator(".friendly-error details");
  await expect(details).not.toHaveAttribute("open");
  await details.locator("summary").click();
  await expect(details).toContainText("long-internal-locator");
  const inspector = page.locator(".inspector");
  expect(
    await inspector.evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await expect(details).not.toContainText("\u001b");
});

test("editor task fields support shopping lists without JSON", async ({
  page,
  request,
}) => {
  await request.put(`/api/workflows/${workflow.id}`, {
    data: {
      ...workflow,
      input: JSON.stringify({
        grocery_list: [],
        budget_usd: 30,
        delivery_zip: "",
        substitutions: false,
      }),
    },
  });
  await page.goto("/#editor");
  await page.getByRole("button", { name: "Run input", exact: true }).click();
  await page
    .getByLabel("Task input: grocery_list")
    .fill("2 cartons of oat milk\n1 bag of oats");
  await page.getByLabel("Task input: delivery_zip").fill("98101");
  await page.getByRole("button", { name: "Close run input" }).click();
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Run input", exact: true }).click();
  await expect(page.getByLabel("Task input: grocery_list")).toHaveValue(
    "2 cartons of oat milk\n1 bag of oats",
  );
  await expect(page.getByLabel("Task input: delivery_zip")).toHaveValue(
    "98101",
  );
});
