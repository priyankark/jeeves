import { build, Platform, Arch } from "electron-builder";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { macSigningConfig, signMacDmg } from "./mac-signing.mjs";
const signing = macSigningConfig();

const appDir = path.resolve(
  `release/Jeeves-${process.platform}-${process.arch}`,
);
const targets = {
  darwin: ["dmg"],
  win32: ["nsis"],
  linux: ["AppImage", "deb"],
};
if (!targets[process.platform])
  throw new Error(`Unsupported platform: ${process.platform}`);
if (!["arm64", "x64"].includes(process.arch))
  throw new Error(`Unsupported architecture: ${process.arch}`);

// Only the explicitly staged app is packaged, never the source workspace.
const artifacts = await build({
  targets: Platform.current().createTarget(
    targets[process.platform],
    Arch[process.arch],
  ),
  prepackaged:
    process.platform === "darwin" ? path.join(appDir, "Jeeves.app") : appDir,
  publish: "never",
  config: {
    appId: "org.jeeves.desktop",
    productName: "Jeeves",
    artifactName: "Jeeves-${version}-${os}-${arch}.${ext}",
    directories: {
      output: "release/installers",
      buildResources: "electron/icons",
    },
    publish: null,
    mac: {
      icon: "electron/icons/jeeves.icns",
      category: "public.app-category.productivity",
      identity: null,
      notarize: false,
    },
    dmg: { sign: false },
    win: { icon: "electron/icons/jeeves.ico", signAndEditExecutable: false },
    nsis: {
      oneClick: false,
      perMachine: false,
      allowToChangeInstallationDirectory: true,
      deleteAppDataOnUninstall: false,
      shortcutName: "Jeeves",
    },
    linux: {
      icon: "electron/icons/jeeves.png",
      category: "Office",
      executableName: "Jeeves",
      maintainer: "Jeeves contributors <noreply@github.com>",
    },
  },
});
for (const file of artifacts.filter((f) =>
  /\.(dmg|exe|AppImage|deb)$/.test(f),
)) {
  if (signing && file.endsWith(".dmg")) await signMacDmg(file, signing);
  const digest = createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
  await writeFile(file + ".sha256", `${digest}  ${path.basename(file)}\n`);
  console.log(`Installer: ${file}`);
}
