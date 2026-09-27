import { test, expect } from "@playwright/test";
import { blank } from "../../shared/templates";
import { makeNode } from "../../shared/schema";

test("a long choice label does not block dragging its connection handle", async ({
  page,
  request,
}) => {
  const workflow = {
    ...blank,
    id: "long-choice-label",
    nodes: [
      makeNode("input", "input", 0, 180),
      makeNode("decision", "choice", 350, 180, {
        questionType: "choice",
        criteria: JSON.stringify({
          needs_information: "Missing facts",
          normal: "Clear noncritical issue",
        }),
      }),
      makeNode("output", "output", 700, 180),
    ],
    edges: [
      { id: "in", source: "input", target: "choice" },
      {
        id: "normal",
        source: "choice",
        sourceHandle: "normal",
        target: "output",
      },
      {
        id: "review",
        source: "choice",
        sourceHandle: "review",
        target: "output",
      },
    ],
  };
  await request.put(`/api/workflows/${workflow.id}`, { data: workflow });
  await page.addInitScript(
    (id) => localStorage.setItem("jeeves-workflow", id),
    workflow.id,
  );
  await page.goto("/#editor");
  const source = page.locator(
    '[data-nodeid="choice"][data-handleid="needs_information"]',
  );
  const target = page.locator('[data-nodeid="output"].target');
  await source.hover();
  await page.mouse.down();
  await target.hover();
  await page.mouse.up();
  await expect(page.locator(".react-flow__edge")).toHaveCount(4);
  await page.getByRole("button", { name: "Validate", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("valid");
});

test("a new step is connected, and deleting an edge does not delete the previously selected node", async ({
  page,
}) => {
  await page.goto("/#workflows");
  await expect(page.getByText("Local engine connected")).toBeVisible();
  await page.locator(".new-workflow").click();
  await page.getByRole("button", { name: "Add node", exact: true }).click();
  await page.getByRole("button", { name: /^Subagent / }).click();
  await expect(page.locator(".flow-node")).toHaveCount(3);
  await expect(page.locator(".react-flow__edge")).toHaveCount(2);
  await page.getByRole("button", { name: "Validate", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("valid");
  await page.getByRole("button", { name: "Undo edit" }).click();
  await expect(page.locator(".flow-node")).toHaveCount(2);
  await page.getByRole("button", { name: "Redo edit" }).click();
  await expect(page.locator(".flow-node")).toHaveCount(3);
  await page.locator(".flow-node.agent").click();
  const edge = page.locator(".react-flow__edge-interaction").first();
  // A horizontal SVG path has zero-height bounds; its visible stroke remains clickable.
  const point = await edge.evaluate((el) => {
    const path = el as SVGPathElement;
    const center = path.getPointAtLength(path.getTotalLength() / 2);
    const screen = new DOMPoint(center.x, center.y).matrixTransform(
      path.getScreenCTM()!,
    );
    return { x: screen.x, y: screen.y };
  });
  await page.mouse.click(point.x, point.y);
  await page.keyboard.press("Backspace");
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);
  await expect(page.locator(".flow-node")).toHaveCount(3);
  await page.getByRole("button", { name: "Undo edit" }).click();
  await expect(page.locator(".react-flow__edge")).toHaveCount(2);
  await expect(page.locator(".flow-node")).toHaveCount(3);
});

test("stopping copilot preserves the request and ignores a late proposal", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/copilot", async (route) => {
    await gate;
    await route
      .fulfill({
        json: {
          message: "Late proposal",
          workflow: route.request().postDataJSON().workflow,
        },
      })
      .catch(() => {});
  });
  await page.goto("/#editor");
  await expect(page.getByText("Local engine connected")).toBeVisible();
  await page.getByRole("button", { name: "Copilot", exact: true }).click();
  const composer = page.getByRole("textbox", { name: "Message copilot" });
  await composer.fill("Create a meeting summary workflow");
  await page.getByRole("button", { name: "Send message" }).click();
  await page.getByRole("button", { name: "Stop designing" }).click();
  await expect(composer).toBeEnabled();
  await expect(composer).toHaveValue("Create a meeting summary workflow");
  release();
  await expect(
    page.getByText("Stopped designing.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Apply to canvas" }),
  ).toHaveCount(0);
});
