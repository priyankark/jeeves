import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

test("a new laptop user gets a labeled sample, downloads it, and reaches their own notes without setup", async ({
  page,
}) => {
  await page.setViewportSize({ width: 960, height: 700 });
  await page.goto("/");
  const tryExample = page.getByRole("button", {
    name: "Try the example",
    exact: true,
  });
  await expect(tryExample).toBeInViewport();
  await tryExample.click();
  await expect(
    page.getByLabel("Task input: notes", { exact: true }),
  ).toContainText("Maya fixed");
  await expect(
    page.getByRole("button", { name: "Run demo", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Run demo", exact: true }),
  ).toBeInViewport();
  await page.getByRole("button", { name: "Run demo", exact: true }).click();
  const result = page.getByRole("region", { name: "Chat run result" });
  await expect(
    result.getByRole("heading", { name: "Customer portal — weekly update" }),
  ).toBeVisible();
  await expect(result).toContainText(
    "Sample result · written for the example notes. No AI was called.",
  );
  const download = page.waitForEvent("download");
  await result.getByRole("button", { name: "Download output" }).click();
  const file = await download;
  expect(await readFile((await file.path())!, "utf8")).toContain(
    "Sample result",
  );
  await page
    .getByRole("button", { name: "Use my own notes", exact: true })
    .click();
  await expect(
    page.getByLabel("Task input: notes", { exact: true }),
  ).toHaveValue("");
  await expect(page.getByLabel("Preview run mode")).toHaveValue("live");
  await expect(
    page.getByRole("button", { name: "Run live", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Task input: notes", { exact: true })
    .fill("My actual notes");
  await page
    .getByRole("button", { name: "Connect an AI service", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Connect AI for your workflow",
  });
  await expect(dialog).toBeVisible();
  await expect(dialog).not.toContainText("TypeSafe");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByLabel("Task input: notes", { exact: true }),
  ).toHaveValue("My actual notes");
  await page.getByRole("button", { name: "New chat", exact: true }).click();
  await expect(tryExample).toBeInViewport();
  await expect(tryExample).toBeFocused();
  await tryExample.click();
  await expect(page.getByLabel("Preview run mode")).toHaveValue("demo");
});

test("edited example notes show simulation details instead of a canned answer", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Try the example", exact: true })
    .click();
  await page
    .getByLabel("Task input: notes", { exact: true })
    .fill("A different task with different facts");
  await page.getByRole("button", { name: "Run demo", exact: true }).click();
  const result = page.getByRole("region", { name: "Chat run result" });
  await expect(result).toContainText("No AI generated an answer to your task.");
  await expect(
    result.getByText("Instructions:", { exact: false }),
  ).not.toBeVisible();
  await result.getByText("Simulation details", { exact: true }).click();
  await expect(result).toContainText("A different task with different facts");
  await expect(result).not.toContainText(
    "Sample result · written for the example notes.",
  );
});

test("connects a local model in place, applies it to both steps, and runs the edited input", async ({
  page,
  request,
}) => {
  const bodies: any[] = [];
  const server = createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/v1/models") {
      res.end(JSON.stringify({ data: [{ id: "fixture-model" }] }));
      return;
    }
    let raw = "";
    for await (const chunk of req) raw += chunk;
    bodies.push(JSON.parse(raw));
    res.end(
      JSON.stringify({
        choices: [
          {
            message: {
              content:
                "# Actual project update\n\n## Progress\nReleased the accessibility fixes.",
            },
          },
        ],
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseURL = `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`;
  try {
    await page.goto("/");
    await page
      .getByRole("button", { name: "Try the example", exact: true })
      .click();
    await page.getByLabel("Preview run mode").selectOption("live");
    await page
      .getByLabel("Task input: project", { exact: true })
      .fill("My actual project");
    await page
      .getByLabel("Task input: notes", { exact: true })
      .fill("Released the accessibility fixes.");
    await page
      .getByRole("button", { name: "Connect an AI service", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Connect AI for your workflow",
    });
    const card = dialog
      .locator(".connection-card")
      .filter({ hasText: "Local model server" });
    await card.getByRole("button", { name: "Connect", exact: true }).click();
    await card.getByLabel("Server endpoint").fill(baseURL);
    await card.getByLabel("Default model").fill("fixture-model");
    await card.getByRole("button", { name: "Save and verify" }).click();
    await expect(card.getByText("Verified", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Back to my task" }).click();
    await expect(
      page.getByLabel("Task input: notes", { exact: true }),
    ).toHaveValue("Released the accessibility fixes.");
    await page
      .getByRole("button", { name: "Use this connection", exact: true })
      .click();
    await expect(
      page.getByText("Applied to 2 steps", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Run live", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Actual project update", exact: true }),
    ).toBeVisible();
    expect(bodies).toHaveLength(2);
    for (const body of bodies) {
      expect(body.model).toBe("fixture-model");
      expect(JSON.stringify(body.messages)).toContain(
        "Released the accessibility fixes.",
      );
      expect(JSON.stringify(body.messages)).not.toContain("Customer portal");
    }
    const id = await page.evaluate(() => localStorage.getItem("jeeves-chat"));
    const chat = await (await request.get(`/api/chats/${id}`)).json();
    const run = await (
      await request.get(`/api/runs/${chat.runIds.at(-1)}`)
    ).json();
    expect(run.mode).toBe("live");
    expect(run.input.notes).toBe("Released the accessibility fixes.");
  } finally {
    await request.put("/api/connections", {
      data: { provider: "local", model: "" },
    });
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
