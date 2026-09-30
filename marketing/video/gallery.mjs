import { chromium } from "playwright-core";
import { readFile, mkdir } from "node:fs/promises";
const out = "marketing/video/gallery";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1270, height: 760 } });
const data = async (path) =>
  `data:image/png;base64,${(await readFile(path)).toString("base64")}`;
const font = (await readFile("site/assets/dm-sans.woff2")).toString("base64");
const style = `<style>@font-face{font-family:DM;src:url(data:font/woff2;base64,${font})}*{box-sizing:border-box}body{margin:0;width:1270px;height:760px;padding:44px 60px;background:#f8f4e9;color:#202923;font-family:DM,Arial,sans-serif}header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #d8d7c8;padding-bottom:22px}.brand{font-weight:750;font-size:28px;letter-spacing:-1px}header small,.eyebrow{font-size:12px;letter-spacing:1.7px;font-weight:600;color:#506342}h1{font:400 58px/1.07 Georgia,serif;letter-spacing:-2px;margin:24px 0}em{color:#506342;font-weight:400}p{font-size:21px;line-height:1.6;color:#60665b}footer{position:absolute;bottom:28px;left:60px;right:60px;display:flex;justify-content:space-between;font-size:12px;color:#60665b}.split{display:grid;grid-template-columns:430px 1fr;gap:50px;align-items:center;height:580px}.split h1{font-size:51px}.split p{font-size:20px;max-width:360px}.shot{display:block;max-width:100%;max-height:548px;margin:auto;border:1px solid #d8d7c8;border-radius:10px;box-shadow:0 12px 30px #20292309}.split .note{font-size:14px;margin-top:30px;max-width:350px}.steps{display:flex;gap:0;margin-top:38px}.step{flex:1;padding:25px 22px;background:#eeeee3;border:1px solid #d5d8c9;border-radius:8px}.step strong{display:block;font-size:20px;margin:16px 0 10px}.step span{font-size:13px;color:#506342}.step p{font-size:15px;margin:0}.arrow{align-self:center;padding:0 14px;color:#506342}.technical{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:36px}.technical article{border-top:1px solid #c8cebc;padding-top:23px}.technical h2{font:400 29px Georgia;margin:15px 0}.technical p{font-size:19px;line-height:1.6}.technical small{font-size:11px;letter-spacing:1.5px;color:#506342}.technical-note{border-top:1px solid #d8d7c8;padding-top:20px;margin-top:24px;font-size:17px}</style>`;
async function render(
  name,
  chapter,
  body,
  foot = "Free and open source · Mac, Windows, and Linux",
) {
  await page.setContent(
    `${style}<header><span class="brand">jeeves</span><small>${chapter}</small></header>${body}<footer><span>${foot}</span><span>getjeeves.app</span></footer>`,
  );
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${out}/${name}.png` });
}
try {
  await render(
    "01-overview",
    "01 / THE IDEA",
    `<h1 style="font-size:78px;margin-top:48px">Turn repeat work<br><em>into a workflow.</em></h1><p>Set up the steps. Let AI do the work. Review the result.</p><div class="steps"><div class="step"><span>YOUR INPUT</span><strong>Project notes</strong><p>What happened this week.</p></div><span class="arrow">→</span><div class="step"><span>YOUR WORKFLOW</span><strong>Draft → Check</strong><p>A process you can change.</p></div><span class="arrow">→</span><div class="step"><span>YOUR RESULT</span><strong>Weekly update</strong><p>Ready for your review.</p></div></div>`,
  );
  await render(
    "02-input",
    "02 / ADD YOUR INPUT",
    `<div class="split"><div><span class="eyebrow">EXAMPLE: THE WEEKLY UPDATE</span><h1>Start with<br><em>your notes.</em></h1><p>Choose a saved workflow and give it the details for this week.</p><p class="note">Actual app screenshot.<br>Built-in example with sample data.</p></div><img class="shot" src="${await data("marketing/video/captures/weekly-input.png")}"></div>`,
    "A repeatable process, starting with new input",
  );
  await render(
    "03-workflow",
    "03 / SEE THE PROCESS",
    `<h1>Every step <em>has a job.</em></h1><p>Draft the update. Check it against the notes. Return the result.</p><img class="shot" style="width:1150px;margin-top:18px;height:320px;max-height:320px;object-fit:cover;object-position:center" src="${await data("marketing/video/captures/weekly-canvas.png")}">`,
    "Actual workflow editor · Sample mode · No AI calls",
  );
  await render(
    "04-result",
    "04 / REVIEW AND REUSE",
    `<div class="split"><div><span class="eyebrow">THE SAME WEEKLY UPDATE</span><h1>A result you<br><em>can work with.</em></h1><p>Read it, copy it, or download it. Next week, reuse the steps with fresh notes.</p><p class="note">Actual app screenshot.<br>Prepared sample result. No AI was called.</p></div><img class="shot" src="${await data("marketing/video/captures/weekly-result.png")}"></div>`,
    "Connect an AI service to generate results from your own input",
  );
  await render(
    "05-how-it-works",
    "05 / UNDER THE HOOD",
    `<h1>Your workflow.<br><em>Your choice of AI.</em></h1><div class="technical"><article><small>DO THE WORK</small><h2>AI steps</h2><p>OpenAI, Codex CLI, OpenRouter, or a local model. Choose the service for each job.</p></article><article><small>CHOOSE A PATH</small><h2>Optional Jev decisions</h2><p>Use TypeSafe’s Jev when an answer should determine which step comes next.</p></article><article><small>ASK YOU</small><h2>Human input</h2><p>Add a question or review step. Jeeves saves progress and waits for your answer.</p></article></div><p class="technical-note">Your workspace stays on your computer. Cloud AI services receive the context you send them.</p>`,
    "Free app · Connected AI services may charge for usage",
  );
  // Keep the thumbnail distinct from wide presentation slides.
  await page.setViewportSize({ width: 240, height: 240 });
  await page.setContent(
    `<style>body{margin:0;background:#f8f4e9;display:grid;place-items:center;height:240px}img{width:180px}</style><img src="${await data("site/assets/jeeves-icon.png")}">`,
  );
  await page.screenshot({ path: out + "/thumbnail.png" });
} finally {
  await browser.close();
}
