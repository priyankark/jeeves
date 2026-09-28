import { chromium } from "playwright-core";
import { mkdir, writeFile, readFile, copyFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const work = "/tmp/jeeves-film",
  out = "site/media";
await mkdir(out, { recursive: true });
const ffmpeg = process.env.FFMPEG || "ffmpeg";

const shots = JSON.parse(await readFile(work + "/shots.json", "utf8"));
const scenes = [
  {
    name: "intro",
    title: "Jev needs Jeeves.",
    sub: "So does your to-do list.",
    voice:
      "Jev needs Jeeves. So does your to-do list. Here is a little direction, for work with a plot twist.",
  },
  {
    name: "01-workflow",
    title: "Give the work a shape.",
    voice:
      "A request comes in. Jeeves gives each step a job, and makes the whole process visible. This is a real workflow, running with Jev and Codex.",
  },
  {
    name: "02-decision",
    title: "Jev makes the judgment.",
    voice:
      "Jev sees a concrete outage and chooses the urgent route. You can inspect the answer, confidence, and the branch it selected.",
  },
  {
    name: "03-waiting",
    title: "A mystery deserves a question.",
    voice:
      "But when a request is vague, guessing is poor form. Jeeves asks for the missing facts, saves the progress, and waits for you.",
  },
  {
    name: "04-answer",
    title: "Your answer moves things along.",
    voice:
      "Add the context and submit. Only then does the next agent pick up the work.",
  },
  {
    name: "05-result",
    title: "Useful work. Ready for review.",
    voice:
      "Your clarification becomes a concrete action brief, with a suggested fix and a draft reply. The facts stay visible. Nothing has been sent.",
  },
  {
    name: "06-export",
    title: "Keep the process. Take it with you.",
    voice:
      "Keep the workflow for next time, or export it as a portable skill with its requirements. A useful process deserves a second outing.",
  },
  {
    name: "outro",
    title: "A little direction.",
    sub: "A lot done.",
    voice:
      "Jev makes the judgment. Jeeves handles the follow-through. Meet your Jeeves.",
  },
];
const b = await chromium.launch({ channel: "chrome", headless: true });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto("http://127.0.0.1:4341");
async function card(scene, path) {
  await p.setContent(
    `<style>@font-face{font-family:DM;src:url(http://127.0.0.1:4341/assets/dm-sans.woff2)}*{box-sizing:border-box}body{margin:0;background:#f8f4e9;color:#202923;font-family:DM}main{height:1080px;padding:92px 110px;display:flex;flex-direction:column;justify-content:space-between}.brand{display:flex;align-items:center;gap:20px;font-size:38px;font-weight:700}img{width:65px;height:65px}.eyebrow{font-size:19px;letter-spacing:4px;color:#506342}h1{font:normal 140px/1.08 Georgia;margin:25px 0;letter-spacing:-7px}em{color:#506342;font-weight:400}.bottom{display:flex;justify-content:space-between;border-top:1px solid #c6cbbb;padding-top:25px;font-size:22px}.tag{padding:12px 20px;border:1px solid #bdc6ae;border-radius:30px;font-size:16px}.orange{background:#e86b40;position:absolute;right:100px;top:160px;width:265px;height:265px;border-radius:28px;transform:rotate(8deg);display:grid;place-items:center;font:italic 170px Georgia;opacity:.95}</style><main><div class="brand"><img src="http://127.0.0.1:4341/assets/jeeves-icon.png">jeeves</div><div><p class="eyebrow">THE JUDGMENT. THE FOLLOW-THROUGH.</p><h1>${scene.title}<br><em>${scene.sub}</em></h1></div><div class="bottom"><span>${scene.name === "intro" ? "Real product footage · Live Jev + Codex" : "jeeves-workflows.vercel.app"}</span><span>${scene.name === "intro" ? "Synthetic requests · Waiting time edited" : "Local-first desktop workflows"}</span></div></main>`,
  );
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path });
}
await card(scenes[0], work + "/intro.png");
await card(scenes.at(-1), work + "/outro.png");
await copyFile(work + "/intro.png", out + "/demo-poster.png");
await p.setViewportSize({ width: 1200, height: 630 });
await p.setContent(
  `<style>@font-face{font-family:DM;src:url(http://127.0.0.1:4341/assets/dm-sans.woff2)}body{margin:0;background:#f8f4e9;color:#202923;padding:65px 80px;font-family:DM}small{font-size:16px;letter-spacing:2px}h1{font:normal 100px/1.05 Georgia;letter-spacing:-5px;margin:45px 0 24px}em{color:#506342}p{font-size:23px}.badge{position:absolute;right:75px;top:65px;font:italic 160px Georgia;width:220px;height:250px;background:#e86b40;border-radius:18px;display:grid;place-items:center;transform:rotate(6deg)}</style><small>JEEVES / THE DESKTOP EDITION</small><div class="badge">j</div><h1>Jev needs<br><em>Jeeves.</em></h1><p>The judgment. The follow-through.</p>`,
);
await p.evaluate(() => document.fonts.ready);
await p.screenshot({ path: out + "/social-card.png" });
await b.close();
const font = "/System/Library/Fonts/Supplemental/Arial.ttf";
let offset = 0;
const timeline = [];
for (const [i, s] of scenes.entries()) {
  const stem = work + "/" + s.name;
  await writeFile(stem + ".txt", s.voice);
  execFileSync("say", [
    "-v",
    "Daniel",
    "-r",
    "165",
    "-f",
    stem + ".txt",
    "-o",
    stem + ".aiff",
  ]);
  const voiceDuration = Number(
    execFileSync("afinfo", [stem + ".aiff"], { encoding: "utf8" }).match(
      /estimated duration: ([0-9.]+)/,
    )[1],
  );
  const shot = shots.find((x) => x.name === s.name);
  const duration = Math.max(voiceDuration + 1, shot?.duration || 0);
  const args = ["-y"];
  if (shot)
    args.push(
      "-ss",
      String(shot.start),
      "-t",
      String(shot.duration),
      "-i",
      work + "/" + (shot.file || "capture.webm"),
    );
  else args.push("-loop", "1", "-i", stem + ".png");
  args.push("-i", stem + ".aiff");
  await writeFile(stem + "-title.txt", s.title);
  await writeFile(
    stem + "-label.txt",
    "LIVE PRODUCT WALKTHROUGH / " + String(i).padStart(2, "0"),
  );
  const filter = shot
    ? `[0:v]scale=1465:824,pad=1920:1080:227:122:color=0xf8f4e9,tpad=stop_mode=clone:stop_duration=60,drawtext=fontfile=${font}:textfile=${stem}-title.txt:fontcolor=0x202923:fontsize=40:x=227:y=52,drawtext=fontfile=${font}:textfile=${stem}-label.txt:fontcolor=0x506342:fontsize=17:x=1250:y=69,setsar=1[v];[1:a]adelay=300|300,apad[a]`
    : `[0:v]scale=1920:1080,setsar=1[v];[1:a]adelay=300|300,apad[a]`;
  args.push(
    "-filter_complex",
    filter,
    "-map",
    "[v]",
    "-map",
    "[a]",
    "-t",
    String(duration),
    "-r",
    "30",
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "21",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    stem + ".mp4",
  );
  execFileSync(ffmpeg, args, {
    stdio: ["ignore", "ignore", "pipe"],
    maxBuffer: 10_000_000,
  });
  timeline.push({ ...s, start: offset, duration });
  offset += duration;
  console.log(s.name, duration.toFixed(1));
}
await writeFile(
  work + "/concat.txt",
  scenes.map((s) => `file '${work}/${s.name}.mp4'`).join("\n"),
);
execFileSync(
  ffmpeg,
  [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    work + "/concat.txt",
    "-c",
    "copy",
    "-movflags",
    "+faststart",
    out + "/jeeves-demo.mp4",
  ],
  { stdio: ["ignore", "ignore", "pipe"] },
);
const time = (v) => {
  const ms = Math.round(v * 1000);
  return `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`;
};
let vtt = "WEBVTT\n\n";
for (const s of timeline) {
  const chunks = s.voice.match(/[^.!?]+[.!?]+/g) || [s.voice];
  const total = chunks.reduce((n, c) => n + c.length, 0);
  let pos = s.start + 0.3;
  for (const chunk of chunks) {
    const duration = ((s.duration - 0.7) * chunk.length) / total;
    vtt += `${time(pos)} --> ${time(pos + duration)}\n${chunk.trim()}\n\n`;
    pos += duration;
  }
}
await writeFile(out + "/jeeves-demo.vtt", vtt);
await writeFile(
  "marketing/video/timeline.json",
  JSON.stringify(timeline, null, 2) + "\n",
);
const transcript = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Jeeves demo transcript</title><link rel="icon" href="/assets/jeeves-icon.png"><link rel="stylesheet" href="/style.css"></head><body><main class="wrap section"><a href="/#film">← Back to the demo</a><h1 class="transcript-title">The moving picture.</h1><p>Real live Jev and Codex runs, recorded with synthetic requests. Waiting time is edited out. Narration uses the macOS Daniel voice.</p>${timeline.map((s) => `<section><h2 class="transcript-heading">${time(s.start).slice(3, 8)} · ${s.title}</h2><p class="lede">${s.voice}</p></section>`).join("")}</main></body></html>`;
await writeFile("site/transcript.html", transcript);
console.log(
  JSON.stringify({ duration: offset, file: out + "/jeeves-demo.mp4" }),
);
