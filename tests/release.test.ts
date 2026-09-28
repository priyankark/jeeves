import { afterEach, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";

const temporary: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporary.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});
async function workspace() {
  const dir = await mkdtemp(path.join(tmpdir(), "jeeves-release-test-"));
  temporary.push(dir);
  await writeFile(
    path.join(dir, "package.json"),
    JSON.stringify({ version: "0.1.0-preview.1" }),
  );
  return dir;
}
const script = (name: string, cwd: string, env = process.env) =>
  execFileSync(process.execPath, [path.resolve("scripts", name)], {
    cwd,
    env,
    stdio: "pipe",
  });

it("rejects missing platform installers and modified downloads before publication", async () => {
  const dir = await workspace();
  const assets = path.join(dir, "release-assets");
  await mkdir(assets);
  const names = [
    "mac-arm64.dmg",
    "mac-x64.dmg",
    "win-x64.exe",
    "linux-x64.AppImage",
    "linux-x64.deb",
  ].map((suffix) => `Jeeves-0.1.0-preview.1-${suffix}`);
  const bytes = Buffer.alloc(1_000_001, 42);
  const hash = createHash("sha256").update(bytes).digest("hex");
  for (const name of names) {
    await writeFile(path.join(assets, name), bytes);
    await writeFile(path.join(assets, name + ".sha256"), `${hash}  ${name}\n`);
  }
  script("verify-release-assets.mjs", dir);
  expect(
    (await readFile(path.join(assets, "SHA256SUMS.txt"), "utf8"))
      .trim()
      .split("\n"),
  ).toHaveLength(5);
  await rm(path.join(assets, "SHA256SUMS.txt"));
  await writeFile(path.join(assets, names[0]), Buffer.alloc(1_000_001, 43));
  expect(() => script("verify-release-assets.mjs", dir)).toThrow();
  await writeFile(path.join(assets, names[0]), bytes);
  await rm(path.join(assets, names[1]));
  expect(() => script("verify-release-assets.mjs", dir)).toThrow();
});

it("rejects a release tag that does not match the bundled version", async () => {
  const dir = await workspace();
  const env = {
    ...process.env,
    GITHUB_REF_TYPE: "tag",
    GITHUB_REF_NAME: "v0.1.0-preview.1",
    EXPECTED_ARCH: process.arch,
    EXPECTED_PLATFORM: process.platform,
  };
  expect(() => script("check-release-version.mjs", dir, env)).not.toThrow();
  expect(() =>
    script("check-release-version.mjs", dir, {
      ...env,
      GITHUB_REF_NAME: "v0.2.0",
    }),
  ).toThrow();
  expect(() =>
    script("check-release-version.mjs", dir, {
      ...env,
      EXPECTED_ARCH: "unsupported",
    }),
  ).toThrow();
});
