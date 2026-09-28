import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
const base = process.env.SITE_URL || "http://127.0.0.1:4341";
const output = process.env.SITE_CHECK_DIR || "marketing/video/site-checks";
const b = await chromium.launch({ channel: "chrome", headless: true });
const p = await b.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const checks = [];
await mkdir(output, { recursive: true });
try {
  for (const width of [320, 390, 768, 1280, 1440]) {
    await p.setViewportSize({ width, height: 900 });
    await p.goto(base);
    await p.evaluate(() => document.fonts.ready);
    assert(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Horizontal overflow at ${width}`,
    );
    for (const name of ["A small fix", "A mystery", "An outage"]) {
      const button = p.getByRole("button", { name, exact: true });
      await button.click();
      assert.equal(await button.getAttribute("aria-pressed"), "true");
    }
    await p.screenshot({
      path: `${output}/${width}.png`,
      fullPage: true,
    });
    checks.push(
      `No horizontal overflow; all three example routes work at ${width}px`,
    );
  }
  await p.goto(base);
  await p.getByRole("button", { name: "A mystery", exact: true }).focus();
  await p.keyboard.press("Enter");
  assert.match(await p.locator("#example-result").innerText(), /pauses/);
  checks.push("Example selection works from the keyboard");
  const targets = await p
    .locator("a[href],source[src],link[rel=stylesheet],script[src],track[src]")
    .evaluateAll((els) =>
      els.map((e) => e.getAttribute("href") || e.getAttribute("src")),
    );
  for (const target of new Set(targets)) {
    if (target.startsWith("#")) {
      if (target.length > 1) assert(await p.locator(target).count());
    } else if (target.startsWith("/")) {
      const r = await p.request.get(base + target);
      assert(r.ok(), `Missing ${target}`);
    }
  }
  checks.push(
    "All local links, media, captions, script, stylesheet, and workflow download return successfully",
  );
  await p.locator("video").evaluate(async (v) => {
    v.muted = true;
    await v.play();
  });
  await p.waitForFunction(
    () => document.querySelector("video").currentTime > 0.3,
  );
  const media = await p.locator("video").evaluate((v) => ({
    width: v.videoWidth,
    height: v.videoHeight,
    duration: v.duration,
    captions: v.textTracks.length,
  }));
  assert.equal(media.width, 1920);
  assert.equal(media.height, 1080);
  assert(media.duration > 60 && media.duration < 80);
  assert.equal(media.captions, 1);
  checks.push("1080p MP4 decodes and plays, with a caption track");
  await p.goto(base + "/transcript.html");
  assert(await p.getByRole("heading", { name: "The moving picture." }).count());
  checks.push("Accessible transcript loads");
  assert.deepEqual(errors, []);
  checks.push("No browser JavaScript or console errors");
  const report = {
    url: base,
    testedAt: new Date().toISOString(),
    checks,
    media,
  };
  await writeFile(
    `${output}/report.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await b.close();
}
