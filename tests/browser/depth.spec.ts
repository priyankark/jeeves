import { test, expect } from "@playwright/test";
import { blank, groceryCart } from "../../shared/templates";
import { makeNode } from "../../shared/schema";
test("maintainer configures pagination, preserves its limit, and disables it for POST", async ({
  page,
  request,
}) => {
  const workflow = {
    ...blank,
    id: "pagination-designer",
    nodes: [
      blank.nodes[0],
      makeNode("action", "read", 300, 0, {
        label: "Read repository pages",
        url: "https://api.github.com/repos/nodejs/node/issues",
      }),
      blank.nodes[1],
    ],
    edges: [
      { id: "a", source: "input", target: "read" },
      { id: "b", source: "read", target: "output" },
    ],
  };
  await request.put("/api/workflows/" + workflow.id, { data: workflow });
  await page.addInitScript(
    (id) => localStorage.setItem("jeeves-workflow", id),
    workflow.id,
  );
  await page.goto("/#editor");
  await page
    .locator(".flow-node")
    .filter({ hasText: "Read repository pages" })
    .click();
  await page.getByLabel("Follow API pagination", { exact: true }).check();
  await page.getByLabel("Maximum pages", { exact: true }).fill("3");
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  await page.reload();
  await page
    .locator(".flow-node")
    .filter({ hasText: "Read repository pages" })
    .click();
  await expect(page.getByLabel("Maximum pages", { exact: true })).toHaveValue(
    "3",
  );
  await page.getByLabel("HTTP method", { exact: true }).selectOption("POST");
  await expect(
    page.getByLabel("Follow API pagination", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  const workflows = await (await request.get("/api/workflows")).json();
  const saved = workflows.find((item: { id: string }) => item.id === workflow.id);
  expect(
    saved.nodes.find((n: { id: string }) => n.id === "read").data.paginate,
  ).toBe(false);
});
test("failed browser run offers its saved session and last screenshot directly on Home", async ({
  page,
}) => {
  const workflow = structuredClone(groceryCart);
  const runId = "failed-browser-fixture";
  const session = {
    id: "browser-chat-fixture",
    title: "Review my cart",
    updatedAt: new Date().toISOString(),
    messages: [],
    revision: "r1",
    runIds: [runId],
    mode: "live",
  };
  const run = {
    id: runId,
    workflowId: workflow.id,
    workflowName: workflow.name,
    mode: "live",
    status: "failed",
    startedAt: new Date().toISOString(),
    workflow,
    events: [],
    error: "The browser agent returned an invalid action.",
    nodes: Object.fromEntries(
      workflow.nodes.map((n) => [
        n.id,
        {
          status: n.data.kind === "browser" ? "failed" : "cancelled",
          ...(n.data.kind === "browser"
            ? {
                startedAt: new Date().toISOString(),
                artifact: "last-browser.png",
              }
            : {}),
        },
      ]),
    ),
  };
  await page.addInitScript(() =>
    localStorage.setItem("jeeves-chat", "browser-chat-fixture"),
  );
  await page.route("**/api/chats", (route) =>
    route.fulfill({ json: [session] }),
  );
  await page.route("**/api/chats/browser-chat-fixture", (route) =>
    route.fulfill({ json: session }),
  );
  await page.route("**/api/runs/" + runId, (route) =>
    route.fulfill({ json: run }),
  );
  let opened = false;
  await page.route("**/api/runs/" + runId + "/browser/shop/open", (route) => {
    opened = true;
    return route.fulfill({ json: { opened: true } });
  });
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Download last browser screenshot" }),
  ).toHaveAttribute("href", "/api/artifacts/last-browser.png");
  await page
    .getByRole("button", { name: "Review browser · Prepare grocery cart" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Browser opened with the saved session",
  );
  expect(opened).toBe(true);
});
