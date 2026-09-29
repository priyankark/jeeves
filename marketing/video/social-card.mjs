import { chromium } from "playwright-core";
import { pathToFileURL } from "node:url";

export async function renderSocialCard(
  page,
  path = "site/media/social-card.png",
) {
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(`
    <style>
      *{box-sizing:border-box}body{margin:0;background:#f8f4e9;color:#202923;padding:64px 76px;font-family:Arial,sans-serif}
      small{font-size:16px;letter-spacing:2px}h1{font:normal 88px/1.08 Georgia,serif;letter-spacing:-4px;margin:65px 0 28px;max-width:850px}
      em{color:#506342}p{font-size:25px;line-height:1.5;margin:0;max-width:900px}
      .badge{position:absolute;right:78px;top:64px;font:italic 100px Georgia,serif;width:130px;height:150px;background:#e86b40;border-radius:14px;display:grid;place-items:center;transform:rotate(6deg)}
      footer{position:absolute;bottom:48px;left:76px;font-size:17px;color:#506342}
    </style>
    <small>JEEVES / THE DESKTOP EDITION</small><div class="badge">j</div>
    <h1>Save the steps.<br><em>Use them again.</em></h1>
    <p>Reusable AI workflows for everyday tasks.</p>
    <footer>Open source · Mac, Windows, and Linux</footer>
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
