import { packager } from "@electron/packager";
import { mkdtemp, mkdir, cp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
const staging = await mkdtemp(path.join(tmpdir(), "jeeves-desktop-"));
try {
  for (const dir of ["dist", "runtime", "electron", "marketplace"])
    await cp(dir, path.join(staging, dir), { recursive: true });
  for (const file of ["LICENSE"]) await cp(file, path.join(staging, file));
  const source = JSON.parse(await readFile("package.json", "utf8"));
  await writeFile(
    path.join(staging, "package.json"),
    JSON.stringify(
      {
        name: "jeeves",
        version: source.version,
        description: source.description,
        license: "MIT",
        main: "electron/main.cjs",
      },
      null,
      2,
    ),
  );
  const paths = await packager({
    dir: staging,
    out: "release",
    name: "Jeeves",
    appBundleId: "org.jeeves.desktop",
    appCategoryType: "public.app-category.productivity",
    icon: path.resolve("electron/icons/jeeves"),
    platform: process.platform,
    arch: process.arch,
    electronVersion: JSON.parse(
      await readFile("node_modules/electron/package.json", "utf8"),
    ).version,
    overwrite: true,
    prune: false,
    asar: false,
  });
  if (process.platform === "darwin") {
    // Local ad-hoc signature keeps the modified ARM app bundle consistent.
    // This is not Developer ID signing or notarization.
    for (const output of paths)
      execFileSync("codesign", [
        "--force",
        "--deep",
        "--sign",
        "-",
        path.join(output, "Jeeves.app"),
      ]);
  }
  console.log("Packaged desktop:", paths.join(", "));
} finally {
  await rm(staging, { recursive: true, force: true });
}
