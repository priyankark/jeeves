import { readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import path from "node:path";
const { version } = JSON.parse(await readFile("package.json", "utf8"));
const expected = [
  "mac-arm64.dmg",
  "mac-x64.dmg",
  "win-x64.exe",
  "linux-x86_64.AppImage",
  "linux-amd64.deb",
].map((suffix) => `Jeeves-${version}-${suffix}`);
const names = await readdir("release-assets");
assert.deepEqual(
  names.filter((name) => !name.endsWith(".sha256")).sort(),
  [...expected].sort(),
  "The release must include every platform",
);
const sums = [];
for (const name of expected) {
  const bytes = await readFile(path.join("release-assets", name));
  assert.ok(bytes.length > 1_000_000, `Installer looks incomplete: ${name}`);
  const line = `${createHash("sha256").update(bytes).digest("hex")}  ${name}\n`;
  assert.equal(
    await readFile(path.join("release-assets", name + ".sha256"), "utf8"),
    line,
  );
  sums.push(line);
}
await writeFile("release-assets/SHA256SUMS.txt", sums.join(""));
console.log(
  `Verified ${expected.length} installers and their SHA-256 checksums.`,
);
