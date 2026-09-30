import { chromium } from "playwright-core";
import { mkdir, writeFile } from "node:fs/promises";
const out = "marketing/video/captures";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  await page.goto(process.env.JEEVES_DEMO_URL || "http://127.0.0.1:4342");
  await page
    .getByRole("button", { name: "Try the example", exact: true })
    .click();
  await page.getByRole("button", { name: "Run demo", exact: true }).waitFor();
  await page
    .getByRole("region", { name: "Workflow run preview" })
    .screenshot({ path: `${out}/weekly-input.png` });
  await page.getByRole("button", { name: "Run demo", exact: true }).click();
  const result = page.getByRole("region", { name: "Chat run result" });
  await result
    .getByRole("heading", {
      name: "Customer portal — weekly update",
      exact: true,
    })
    .waitFor();
  await result.screenshot({ path: `${out}/weekly-result.png` });
  await page.getByRole("button", { name: "Open editor", exact: true }).click();
  for (const name of [
    "Collapse workspace sidebar",
    "Hide navigation rail",
    "Close workspace panel",
  ]) {
    const button = page.getByRole("button", { name, exact: true });
    if (await button.isVisible()) await button.click();
  }
  await page.getByRole("button", { name: "Fit View", exact: true }).click();
  await page.waitForTimeout(500);
  await page
    .locator(".react-flow")
    .screenshot({ path: `${out}/weekly-canvas.png` });
  await writeFile(
    `${out}/README.md`,
    "# Gallery source captures\n\nActual Jeeves UI from an isolated workspace, captured with `capture-weekly.mjs`. The weekly update uses the built-in sample notes and prepared sample result. No AI service was called. Screenshots are cropped to the relevant interface; their contents are not rewritten.\n",
  );
} finally {
  await browser.close();
}
