import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { unzipSync } from "fflate";
import { buildKit } from "./build-kit.mjs";

const { files, listing } = await buildKit();
const archive = unzipSync(await readFile("site/media/jeeves-launch-kit.zip"));
assert.deepEqual(
  Object.keys(archive).sort(),
  Object.keys(files).sort(),
  "Launch kit file list is stale",
);
for (const [name, bytes] of Object.entries(files)) {
  assert(
    Buffer.from(archive[name]).equals(bytes),
    `Rebuild launch kit: ${name} changed`,
  );
  if (/\.png$/.test(name)) {
    assert(
      bytes.subarray(1, 4).equals(Buffer.from("PNG")),
      `${name} is not a PNG`,
    );
    if (name === listing.thumbnail || listing.gallery.includes(name)) {
      const expected = name === listing.thumbnail ? [240, 240] : [1270, 760];
      assert.deepEqual(
        [bytes.readUInt32BE(16), bytes.readUInt32BE(20)],
        expected,
        `${name} dimensions`,
      );
      assert(bytes.length < 3_000_000, `${name} exceeds the image limit`);
    }
  }
  if (/\.txt$/.test(name))
    assert(!bytes.toString().includes("\u2014"), `${name} contains an em dash`);
}
assert(listing.tagline.length <= 60, "Product Hunt tagline is too long");
assert(
  listing.description.length <= 500,
  "Product Hunt description is too long",
);
assert(
  !listing.tagline.includes("\u2014") &&
    !listing.description.includes("\u2014"),
);
assert(listing.gallery.length >= 2);
assert.equal(new URL(listing.website).search, "");
assert(files["youtube-title.txt"].toString().trim().length <= 100);
const manifest = JSON.parse(Buffer.from(archive["manifest.json"]).toString());
for (const entry of manifest.files) {
  assert.equal(
    entry.sha256,
    createHash("sha256").update(archive[entry.name]).digest("hex"),
  );
}
const page = await readFile("site/index.html", "utf8");
assert(
  page.includes(listing.release),
  "Website download version differs from the kit",
);
assert(
  page.includes("template=first_run.yml"),
  "First-run feedback link is missing",
);
for (const ext of ["mp4", "vtt"]) {
  const version = createHash("sha256")
    .update(files[`jeeves-demo.${ext}`])
    .digest("hex")
    .slice(0, 12);
  assert(
    page.includes(`/media/jeeves-demo.${ext}?v=${version}`),
    `Website has stale ${ext} version`,
  );
}
console.log(
  `Launch kit passed: ${Object.keys(files).length} files; current media, hashes, image sizes, copy limits, and no em dashes in posts.`,
);
if (process.argv.includes("--live")) {
  async function get(url, options = {}) {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(30000),
      ...options,
    });
    assert(response.ok, `${response.status}: ${url}`);
    return response;
  }
  const livePage = await (await get(listing.website)).text();
  assert(livePage.includes("Jeeves is an app for productivity workflows."));
  assert(livePage.includes(listing.release));
  const publicKit = Buffer.from(
    await (
      await get(`${listing.website}media/jeeves-launch-kit.zip`)
    ).arrayBuffer(),
  );
  assert(
    publicKit.equals(await readFile("site/media/jeeves-launch-kit.zip")),
    "Public launch kit is stale",
  );
  for (const file of ["robots.txt", "sitemap.xml"]) {
    const body = await (await get(`${listing.website}${file}`)).text();
    assert(body.includes("https://getjeeves.app/"), `Invalid ${file}`);
  }
  for (const [name, local] of Object.entries(files).filter(([name]) =>
    /^(jeeves-demo\.(mp4|vtt))$/.test(name),
  )) {
    const data = Buffer.from(
      await (await get(`${listing.website}media/${name}`)).arrayBuffer(),
    );
    assert(data.equals(local), `Public ${name} differs from kit`);
  }
  const repo = "https://github.com/priyankark/jeeves";
  for (const url of [
    repo,
    `${repo}/blob/main/LICENSE`,
    `${repo}/blob/main/docs/QUICKSTART.md`,
    `${repo}/releases/tag/${listing.release}`,
    `${repo}/issues/new?template=first_run.yml`,
  ])
    await get(url, { method: "HEAD" });
  const prefix = `${repo}/releases/download/${listing.release}/`;
  const sums = await (await get(prefix + "SHA256SUMS.txt")).text();
  const links = [
    ...livePage.matchAll(
      /href="(https:\/\/github.com\/priyankark\/jeeves\/releases\/download\/[^"?]+\.(?:dmg|exe|AppImage|deb))"/g,
    ),
  ].map((m) => m[1]);
  assert.equal(new Set(links).size, 5, "Expected five direct installers");
  for (const url of links) {
    assert(url.startsWith(prefix), "Installer points to a different release");
    await get(url, { method: "HEAD" });
    const checksum = (await (await get(url + ".sha256")).text()).trim();
    assert(/^[a-f0-9]{64}\s+/.test(checksum));
    assert(
      sums.split(/\r?\n/).some((line) => line.trim() === checksum),
      "Checksum sidecar differs from release manifest",
    );
    if (process.argv.includes("--download-installers")) {
      const response = await get(url, { signal: AbortSignal.timeout(180000) });
      const hash = createHash("sha256");
      let bytes = 0;
      for await (const chunk of response.body) {
        hash.update(chunk);
        bytes += chunk.length;
      }
      assert.equal(
        hash.digest("hex"),
        checksum.split(/\s+/)[0],
        `Downloaded installer checksum mismatch: ${url}`,
      );
      console.log(
        `Verified downloaded bytes: ${url.split("/").at(-1)} (${bytes} bytes)`,
      );
    }
  }
  for (const host of ["www.getjeeves.app", "jeeves-workflows.vercel.app"]) {
    const response = await fetch(
      `https://${host}/transcript.html?from=launch-check`,
      { redirect: "manual", signal: AbortSignal.timeout(30000) },
    );
    assert.equal(response.status, 308);
    assert.equal(
      response.headers.get("location"),
      `${listing.website}transcript.html?from=launch-check`,
    );
  }
  console.log(
    "Live checks passed: public site, current media, source, license, setup guide, five installers, checksum manifests, and domain redirects.",
  );
}
