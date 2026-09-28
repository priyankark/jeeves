import { test, expect, type Page } from "@playwright/test";

async function freshWorkspace(page: Page, configured = false) {
  const providers = {
    typesafe: false,
    openai: configured,
    openrouter: false,
    local: false,
    codex: false,
    models: { openai: "gpt-4.1-mini", openrouter: "", local: "", codex: "" },
  };
  await page.route("**/api/chats", async (route) => {
    if (route.request().method() === "GET") await route.fulfill({ json: [] });
    else await route.continue();
  });
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { providers, version: "test" } }),
  );
  return providers;
}

test("fresh users can skip setup, keep that choice, and return to connections", async ({
  page,
}) => {
  await freshWorkspace(page);
  await page.goto("/");
  await expect(
    page.getByRole("main", { name: "Welcome to Jeeves" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Skip setup for now" }).click();
  await expect(
    page.getByRole("heading", { name: "Turn repeat work into a workflow." }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("main", { name: "Welcome to Jeeves" }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Set up AI", exact: true }).click();
  await page.getByRole("button", { name: "Set up my AI connections" }).click();
  await expect(
    page.getByRole("region", { name: "Jev decision connection" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Agent AI connection" }),
  ).toBeVisible();
});

test("fresh laptop users reach the key-free example without scrolling", async ({
  page,
}) => {
  await freshWorkspace(page);
  await page.setViewportSize({ width: 960, height: 700 });
  await page.goto("/");
  const sample = page.getByRole("button", {
    name: "Try the example",
    exact: true,
  });
  await expect(sample).toBeInViewport();
  await sample.click();
  await expect(page.getByLabel("Preview run mode")).toHaveValue("demo");
  await page.getByRole("button", { name: "Run demo", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Chat run result" }),
  ).toContainText("No AI was called.");
});

test("failed keys stay visible, corrected Jev and OpenAI keys verify without browser storage", async ({
  page,
}) => {
  const providers = await freshWorkspace(page);
  const saved: Record<string, string> = {};
  let writes = 0;
  await page.route("**/api/connections", async (route) => {
    const body = route.request().postDataJSON();
    writes++;
    saved[body.provider] = body.apiKey;
    (providers as any)[body.provider] = true;
    await route.fulfill({ json: { providers } });
  });
  await page.route("**/api/connections/*/check", (route) => {
    const provider = route.request().url().split("/").at(-2)!;
    const ok = saved[provider] === `fixture-${provider}-valid`;
    return route.fulfill({
      json: {
        ok,
        detail: ok
          ? "Connection verified"
          : "The key was rejected. Check it and try again.",
        latencyMs: 10,
        checkedAt: new Date().toISOString(),
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Set up my AI connections" }).click();
  const jev = page.getByRole("region", { name: "Jev decision connection" });
  await jev.getByRole("button", { name: "Connect", exact: true }).click();
  const key = jev.getByLabel("Jev · TypeSafe API key");
  await expect(key).toHaveAttribute("type", "password");
  await key.fill("fixture-invalid-key");
  await jev.getByRole("button", { name: "Save and verify" }).click();
  await expect(jev.getByText("Check failed", { exact: true })).not.toHaveClass(
    /connected/,
  );
  await expect(key).toBeVisible();
  await key.fill("fixture-typesafe-valid");
  await jev.getByRole("button", { name: "Save and verify" }).click();
  await expect(jev.getByText("Verified", { exact: true })).toBeVisible();
  const openai = page
    .locator(".connection-card")
    .filter({ has: page.getByText("OpenAI", { exact: true }) });
  await openai.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(openai.getByRole("link")).toHaveAttribute(
    "href",
    "https://platform.openai.com/api-keys",
  );
  await openai.getByLabel("OpenAI API key").fill("fixture-openai-valid");
  await openai.getByRole("button", { name: "Save and verify" }).click();
  await expect(openai.getByText("Verified", { exact: true })).toBeVisible();
  await page.route("**/api/connections/openai/check", (route) =>
    route.fulfill({ status: 503, json: { error: "Service unavailable" } }),
  );
  await openai.getByRole("button", { name: "Test connection" }).click();
  await expect(
    openai.getByText("Check failed", { exact: true }),
  ).not.toHaveClass(/connected/);
  await expect(openai.getByText("Verified", { exact: true })).not.toBeVisible();
  expect(writes).toBe(3);
  expect(
    await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    ),
  ).not.toContain("fixture-");
  await page.getByRole("button", { name: "Open my workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Turn repeat work into a workflow." }),
  ).toBeVisible();
});

test("existing connected users retain direct access to their workspace", async ({
  page,
}) => {
  await freshWorkspace(page, true);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Turn repeat work into a workflow." }),
  ).toBeVisible();
  await expect(
    page.getByRole("main", { name: "Welcome to Jeeves" }),
  ).not.toBeVisible();
});

test("connecting Codex alone selects it for the workflow builder", async ({
  page,
}) => {
  const providers = await freshWorkspace(page);
  await page.route("**/api/connections", async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      provider: "codex",
      enabled: true,
    });
    providers.codex = true;
    await route.fulfill({ json: { providers } });
  });
  await page.route("**/api/connections/codex/check", (route) =>
    route.fulfill({
      json: {
        ok: true,
        detail: "CLI login verified",
        latencyMs: 10,
        checkedAt: new Date().toISOString(),
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Set up my AI connections" }).click();
  const card = page
    .locator(".connection-card")
    .filter({ hasText: "Codex harness" });
  await card.getByRole("button", { name: "Use CLI login" }).click();
  await card.getByRole("button", { name: "Save and verify" }).click();
  await expect(card.getByText("Verified", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open my workspace" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByLabel("Copilot provider")).toHaveValue("codex");
});

test("setup works with the keyboard on a narrow screen", async ({ page }) => {
  await freshWorkspace(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const connect = page.getByRole("button", {
    name: "Set up my AI connections",
  });
  await connect.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Connect the AI you want to use." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Connect the AI you want to use." }),
  ).toBeFocused();
  await expect(
    page.getByRole("heading", { name: "Connect the AI you want to use." }),
  ).toBeInViewport();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  expect(overflow).toBe(false);
  const finish = page.getByRole("button", { name: "Open my workspace" });
  await finish.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Set up AI", exact: true }),
  ).toBeVisible();
});
