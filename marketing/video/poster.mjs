import { chromium } from "playwright-core";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export async function renderPoster(page, path = "site/media/demo-poster.png") {
  const screenshot = (
    await readFile("/tmp/jeeves-film/01-workflow.png")
  ).toString("base64");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.setContent(`
    <style>
      *{box-sizing:border-box}body{margin:0;background:#f8f4e9;color:#202923;padding:46px 70px;font-family:Arial,sans-serif}
      header{display:flex;justify-content:space-between;align-items:center;margin-bottom:28px}
      h1{font:normal 58px Georgia,serif;letter-spacing:-2px;margin:0}span{font-size:30px;font-weight:bold}
      img{display:block;max-width:100%;height:830px;object-fit:contain;margin:auto;border-radius:10px}
      footer{font-size:18px;color:#506342;margin-top:24px;text-align:center}
    </style>
    <header><h1>A closer look at how Jeeves works.</h1><span>jeeves</span></header>
    <img src="data:image/png;base64,${screenshot}" alt="Jeeves workflow editor">
    <footer>Technical walkthrough · Jev decisions, AI steps, and human input</footer>
  `);
  await page.screenshot({ path });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    await renderPoster(await browser.newPage());
  } finally {
    await browser.close();
  }
}
