import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const { version } = JSON.parse(await readFile("package.json", "utf8"));
assert.match(version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
if (process.env.GITHUB_REF_TYPE === "tag")
  assert.equal(
    process.env.GITHUB_REF_NAME,
    `v${version}`,
    "Release tag must match package.json version",
  );
if (process.env.EXPECTED_ARCH)
  assert.equal(process.arch, process.env.EXPECTED_ARCH);
if (process.env.EXPECTED_PLATFORM)
  assert.equal(process.platform, process.env.EXPECTED_PLATFORM);
console.log(`Release ${version}: ${process.platform}/${process.arch}`);
