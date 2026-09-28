import { chromium } from "playwright-core";
import { mkdir, writeFile, readFile } from "node:fs/promises";
const base = process.env.JEEVES_DEMO_URL || "http://127.0.0.1:4340";
const out = "/tmp/jeeves-film";
await mkdir(out, { recursive: true });
const audit = JSON.parse(
  await readFile("marketing/video/live-audit.json", "utf8"),
);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
  recordVideo: { dir: out, size: { width: 1280, height: 720 } },
});
const page = await context.newPage();
const start = performance.now();
const shots = [];
const wait = (ms) => page.waitForTimeout(ms);
const shoot = async (name, duration = 7000) => {
  const s = (performance.now() - start) / 1000;
  await wait(500);
  await page.screenshot({ path: `${out}/${name}.png` });
  await wait(duration);
  shots.push({ name, start: s + 0.5, duration: duration / 1000 });
};
async function openRun(id) {
  await page.goto(base + "/#editor");
  await page
    .getByRole("button", { name: /^(Show|Hide) navigation rail$/ })
    .waitFor();
  const show = page.getByRole("button", {
    name: "Show navigation rail",
    exact: true,
  });
  if (await show.isVisible()) await show.click();
  await page
    .getByRole("button", { name: "Run history", exact: true })
    .first()
    .click();
  const runs = await fetch(base + "/api/runs").then((r) => r.json());
  const order = runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const index = order.findIndex((r) => r.id === id);
  await page.locator(".history-list button").nth(index).click();
  const collapse = page.getByRole("button", {
    name: "Collapse workspace sidebar",
    exact: true,
  });
  if (await collapse.isVisible()) await collapse.click();
  const hide = page.getByRole("button", {
    name: "Hide navigation rail",
    exact: true,
  });
  if (await hide.isVisible()) await hide.click();
}
try {
  await openRun(audit.cases.find((c) => c.name === "urgent").runId);
  await page
    .getByRole("button", { name: "Close workspace panel", exact: true })
    .click();
  await page.getByRole("button", { name: "Fit View", exact: true }).click();
  await shoot("01-workflow", 7000);
  await page
    .getByRole("button", { name: "Toggle side panel", exact: true })
    .click();
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await page
    .locator(".trace-item")
    .filter({ hasText: "Jev · what needs attention?" })
    .click();
  await page
    .getByRole("button", { name: "Expand panel to full screen", exact: true })
    .click();
  await page.locator(".jev-result").scrollIntoViewIfNeeded();
  await shoot("02-decision", 8000);
  await page.keyboard.press("Escape");
  await openRun(audit.waitingRunId);
  await page
    .getByRole("button", { name: "Expand panel to full screen", exact: true })
    .click();
  await page
    .getByRole("form", { name: "A little more context, please" })
    .waitFor();
  await shoot("03-waiting", 6000);
  const field = page.getByLabel("What should we know?", { exact: true });
  await field.click();
  const typing = (performance.now() - start) / 1000;
  await field.pressSequentially(
    "The settings tooltip has a typo. Nobody is blocked. Please draft a small fix ticket.",
    { delay: 35 },
  );
  await wait(1200);
  shots.push({
    name: "04-answer",
    start: typing,
    duration: (performance.now() - start) / 1000 - typing,
  });
  await page
    .getByRole("button", { name: "Submit & continue", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Everything connected.", exact: true })
    .waitFor({ timeout: 180000 });
  await page
    .getByRole("button", { name: "Read final output", exact: true })
    .click();
  await shoot("05-result", 10000);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Share or export", exact: true })
    .click();
  await page.getByRole("button", { name: /^Portable skill/ }).click();
  await shoot("06-export", 7000);
  const run = await fetch(base + "/api/runs/" + audit.waitingRunId).then((r) =>
    r.json(),
  );
  audit.humanHandoff = {
    runId: run.id,
    status: run.status,
    followup: run.nodes.followup.status,
    output: run.nodes.output.output,
  };
  await writeFile(
    "marketing/video/live-audit.json",
    JSON.stringify(audit, null, 2) + "\n",
  );
} finally {
  const video = page.video();
  await context.close();
  await video.saveAs(out + "/capture.webm");
  await writeFile(out + "/shots.json", JSON.stringify(shots, null, 2));
  await browser.close();
  console.log(JSON.stringify({ out, shots }));
}
