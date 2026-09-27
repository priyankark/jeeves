import { build } from "esbuild";
import { mkdir, readFile, writeFile, readdir, cp, rm } from "node:fs/promises";
await mkdir("runtime", { recursive: true });
const portable = await build({
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
const names = new Set(
  Object.keys(portable.metafile.inputs)
    .filter((p) => p.includes("node_modules/"))
    .map((p) => {
      const parts = p.split("node_modules/").at(-1).split("/");
      return parts[0].startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
    }),
);
const notices = [];
for (const name of names) {
  const dir = `node_modules/${name}`;
  const p = JSON.parse(await readFile(`${dir}/package.json`, "utf8"));
  const files = (await readdir(dir)).filter((f) =>
    /^(license|licence|copying|notice)(\.|$)/i.test(f),
  );
  notices.push(
    `## ${name}@${p.version} (${p.license || "See package license"})\n`,
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
