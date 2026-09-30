import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { zipSync } from "fflate";

const text = async (path) => readFile(path, "utf8");
const section = (source, name) => {
  const start = source.indexOf(`## ${name}\n`);
  if (start < 0) throw new Error(`Missing copy section: ${name}`);
  return source
    .slice(start + name.length + 4)
    .split(/\n## /)[0]
    .trim();
};
const field = (source, name) => {
  const value = source.match(new RegExp(`\\*\\*${name}:\\*\\* (.+)`))?.[1];
  if (!value) throw new Error(`Missing listing field: ${name}`);
  return value;
};
export async function buildKit() {
  const ph = await text("marketing/copy/product-hunt.md");
  const reddit = await text("marketing/copy/reddit-sideproject.md");
  const youtube = await text("marketing/copy/youtube.md");
  const llmdevs = await text("marketing/copy/reddit-llmdevs.md");
  // The next app version can build while the website still offers the last
  // verified release. Keep the kit tied to those published downloads.
  const site = await text("site/index.html");
  const version = site.match(/\/releases\/download\/v([^/]+)\//)?.[1];
  if (!version) throw new Error("Website has no published release downloads");
  const listing = {
    name: field(ph, "Name"),
    tagline: field(ph, "Tagline"),
    description: field(ph, "Description"),
    website: "https://getjeeves.app/",
    additionalLinks: ["https://github.com/priyankark/jeeves"],
    pricing: "Free",
    pricingNote: "Connected AI providers may charge for usage.",
    suggestedTopics: ["Productivity", "Artificial Intelligence", "Open Source"],
    release: `v${version}`,
    thumbnail: "thumbnail.png",
    gallery: [
      "01-overview.png",
      "02-input.png",
      "03-workflow.png",
      "04-result.png",
      "05-how-it-works.png",
    ],
    video: {
      file: "jeeves-demo.mp4",
      youtubeUrl: field(youtube, "YouTube URL"),
      required: false,
      placement:
        "Technical walkthrough linked in maker comment and website; omit from the main Product Hunt gallery.",
    },
    limitsSource: "https://www.producthunt.com/launch/preparing-for-launch",
    limitsChecked: "2026-09-29",
  };
  const strings = {
    "START-HERE.md": await text("marketing/launch/README.md"),
    "product-hunt-fields.json": JSON.stringify(listing, null, 2),
    "product-hunt-comment.txt": section(ph, "Maker comment draft"),
    "reddit-title.txt": section(reddit, "Title"),
    "reddit-post.txt": section(reddit, "Post"),
    "reddit-llmdevs-title.txt": section(llmdevs, "Title"),
    "reddit-llmdevs-post.txt": section(llmdevs, "Post"),
    "youtube-title.txt": section(youtube, "Title"),
    "youtube-description.txt": section(youtube, "Description"),
  };
  const files = Object.fromEntries(
    Object.entries(strings).map(([name, value]) => [
      name,
      Buffer.from(value.trim() + "\n"),
    ]),
  );
  for (const name of [listing.thumbnail, ...listing.gallery])
    files[name] = await readFile(`marketing/video/gallery/${name}`);
  for (const name of ["jeeves-demo.mp4", "jeeves-demo.vtt", "demo-poster.png"])
    files[name] = await readFile(`site/media/${name}`);
  const manifest = {
    product: "Jeeves",
    release: listing.release,
    files: Object.entries(files).map(([name, bytes]) => ({
      name,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    })),
  };
  files["manifest.json"] = Buffer.from(
    JSON.stringify(manifest, null, 2) + "\n",
  );
  return { files, listing };
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { files } = await buildKit();
  const archive = zipSync(files, { level: 6, mtime: new Date(1980, 0, 1) });
  await writeFile("site/media/jeeves-launch-kit.zip", archive);
  console.log(
    `Launch kit: ${Object.keys(files).length} files, ${archive.length} bytes`,
  );
}
