import { chromium } from "playwright-core";
import { readFile, writeFile, mkdir } from "node:fs/promises";
const out = "marketing/video/gallery";
await mkdir(out, { recursive: true });
const b = await chromium.launch({ channel: "chrome", headless: true });
const p = await b.newPage({ viewport: { width: 1270, height: 760 } });
for (const [file, title, description] of [
  [
    "01-workflow",
    "Save the steps. Use them again.",
    "Give each step a job, review the result, and run it again with new input.",
  ],
  [
    "02-decision",
    "See why it chose this route.",
    "A real Jev decision: answer, confidence, and the route taken.",
  ],
  [
    "03-waiting",
    "It waits for your answer.",
    "Your progress is saved. The workflow waits until you answer.",
  ],
  [
    "05-result",
    "Review the result.",
    "Your clarification becomes an action brief. Nothing is sent.",
  ],
]) {
  const data = (await readFile("/tmp/jeeves-film/" + file + ".png")).toString(
    "base64",
  );
  await p.setContent(
    `<style>body{margin:0;background:#f8f4e9;color:#202923;font-family:Arial;padding:35px 58px}h1{font:normal 44px Georgia;margin:0 0 9px;letter-spacing:-1.5px}p{font-size:16px;color:#506342;margin:0 0 22px}img{width:1084px;border:1px solid #c3cab6;border-radius:8px;display:block;margin:auto}.brand{position:absolute;right:60px;top:45px;font-weight:700;font-size:24px}</style><span class="brand">jeeves</span><h1>${title}</h1><p>${description}</p><img src="data:image/png;base64,${data}">`,
  );
  await p.screenshot({ path: out + "/" + file + ".png" });
}
await p.setViewportSize({ width: 240, height: 240 });
const icon = (await readFile("site/assets/jeeves-icon.png")).toString("base64");
await p.setContent(
  `<style>body{margin:0;background:#f8f4e9;display:grid;place-items:center;height:240px}img{width:180px}</style><img src="data:image/png;base64,${icon}">`,
);
await p.screenshot({ path: out + "/thumbnail.png" });
await b.close();
