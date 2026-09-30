import { chromium } from "playwright-core";
import { pathToFileURL } from "node:url";

export async function renderSocialCard(
  page,
  path = "site/media/social-card.png",
) {
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(`
    <style>
      *{box-sizing:border-box}body{margin:0;background:#f8f4e9;color:#202923;padding:50px 65px;font-family:Arial,sans-serif}
      header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #d8d7c8;padding-bottom:20px}strong{font-size:29px;letter-spacing:-1px}small{font-size:12px;letter-spacing:1.5px;color:#506342}
      h1{font:normal 76px/1.08 Georgia,serif;letter-spacing:-3px;margin:42px 0 24px}em{color:#506342}p{font-size:23px;line-height:1.5;margin:0}
      footer{position:absolute;bottom:44px;left:65px;right:65px;display:flex;justify-content:space-between;font-size:16px;color:#506342}
    </style>
    <header><strong>jeeves</strong><small>AI WORKFLOWS, ON YOUR DESKTOP</small></header>
    <h1>Turn repeat work<br><em>into a workflow.</em></h1>
    <p>Set up the steps. Let AI do the work. Review the result.</p>
    <footer><span>Free and open source · Mac, Windows, and Linux</span><span>getjeeves.app</span></footer>
  `);
  await page.screenshot({ path });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    await renderSocialCard(await browser.newPage());
  } finally {
    await browser.close();
  }
}
