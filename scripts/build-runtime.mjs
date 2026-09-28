import { build } from "esbuild";
import { mkdir, readFile, writeFile, readdir, cp, rm } from "node:fs/promises";
await mkdir("runtime", { recursive: true });
await build({
  entryPoints: ["portable/entry.ts"],
  outfile: "runtime/runner.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  metafile: true,
  legalComments: "inline",
  external: ["playwright-core"],
});
await build({
  entryPoints: ["server/index.ts"],
  outfile: "runtime/server.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  banner: {
    js: 'import { createRequire as __jeevesCreateRequire } from "node:module"; const require = __jeevesCreateRequire(import.meta.url);',
  },
  legalComments: "inline",
  external: ["playwright-core"],
});
// Include production dependencies for the UI and server as well as the runner.
// The runner's import graph alone omits React, Express, and the bundled fonts.
const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
const directories = Object.entries(lock.packages)
  .filter(([dir, metadata]) => dir.startsWith("node_modules/") && !metadata.dev)
  .map(([dir]) => dir)
  .sort();
const notices = [];
for (const dir of directories) {
  let p;
  try {
    p = JSON.parse(await readFile(`${dir}/package.json`, "utf8"));
  } catch (error) {
    // Optional dependencies for other operating systems may not be installed.
    if (error.code === "ENOENT" && lock.packages[dir].optional) continue;
    throw error;
  }
  const files = (await readdir(dir)).filter((f) =>
    /^(license|licence|copying|notice)(\.|$)/i.test(f),
  );
  notices.push(
    `## ${p.name}@${p.version} (${p.license || "See package license"})\n`,
  );
  for (const f of files) notices.push(await readFile(`${dir}/${f}`, "utf8"));
}
await writeFile("runtime/THIRD_PARTY_NOTICES.txt", notices.join("\n\n"));
console.log("Built standalone desktop engine and portable skill runner.");
await rm("runtime/node_modules/playwright-core", {
  recursive: true,
  force: true,
});
await mkdir("runtime/node_modules", { recursive: true });
await cp(
  "node_modules/playwright-core",
  "runtime/node_modules/playwright-core",
  { recursive: true },
);
