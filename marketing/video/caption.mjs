import { readFile, writeFile, copyFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const work = "/tmp/jeeves-film";
const vtt = await readFile("site/media/jeeves-demo.vtt", "utf8");
const assTime = (s) =>
  s
    .replace(/^(\d\d):/, (v) => String(Number(v.slice(0, 2))) + ":")
    .slice(0, -1);
let ass =
  "[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\nWrapStyle: 0\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,30,&H00232920,&H00232920,&H00E9F4F8,&H00E9F4F8,0,0,0,0,100,100,0,0,3,5,0,2,190,190,26,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n";
for (const m of vtt.matchAll(
  /(\d\d:\d\d:\d\d\.\d{3}) --> (\d\d:\d\d:\d\d\.\d{3})\n([^\n]+)/g,
))
  ass += `Dialogue: 0,${assTime(m[1])},${assTime(m[2])},Default,,0,0,0,,${m[3]}\n`;
await writeFile(work + "/captions.ass", ass);
await copyFile("site/media/jeeves-demo.mp4", work + "/master.mp4");
execFileSync(
  process.env.FFMPEG || "ffmpeg",
  [
    "-y",
    "-i",
    work + "/master.mp4",
    "-vf",
    `ass=${work}/captions.ass`,
    "-af",
    "loudnorm=I=-16:LRA=7:TP=-1.5",
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    "site/media/jeeves-demo.mp4",
  ],
  { stdio: ["ignore", "ignore", "pipe"], maxBuffer: 10_000_000 },
);

// Media is cached for an hour. Change the page URLs with each export so
// returning viewers receive the matching film and captions immediately.
let page = await readFile("site/index.html", "utf8");
for (const extension of ["mp4", "vtt"]) {
  const version = createHash("sha256")
    .update(await readFile(`site/media/jeeves-demo.${extension}`))
    .digest("hex")
    .slice(0, 12);
  page = page.replaceAll(
    new RegExp(`(/media/jeeves-demo\\.${extension})(?:\\?[^"\\s]*)?(?=")`, "g"),
    `$1?v=${version}`,
  );
}
await writeFile("site/index.html", page);
