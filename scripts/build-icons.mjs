// The generated artwork is committed; regenerating native formats uses macOS tools.
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

if (process.platform !== "darwin") {
  throw new Error(
    "Icon regeneration requires macOS sips/iconutil. Prebuilt icons are committed for other platforms.",
  );
}
const source = "assets/brand/jeeves-master.png";
const temporary = await mkdtemp(path.join(tmpdir(), "jeeves-icons-"));
const iconset = path.join(temporary, "jeeves.iconset");
await mkdir(iconset);
await mkdir("electron/icons", { recursive: true });
await mkdir("public", { recursive: true });
function resize(size, destination) {
  execFileSync(
    "sips",
    ["-z", String(size), String(size), source, "--out", destination],
    { stdio: "ignore" },
  );
}
try {
  for (const size of [16, 32, 128, 256, 512]) {
    resize(size, path.join(iconset, `icon_${size}x${size}.png`));
    resize(size * 2, path.join(iconset, `icon_${size}x${size}@2x.png`));
  }
  execFileSync("iconutil", [
    "-c",
    "icns",
    iconset,
    "-o",
    "electron/icons/jeeves.icns",
  ]);
  resize(1024, "electron/icons/jeeves.png");
  resize(128, "public/jeeves-icon.png");
  resize(32, "public/favicon-32.png");
  resize(180, "public/apple-touch-icon.png");

  // ICO supports embedded PNGs: retain alpha at each standard Windows size.
  const sizes = [16, 32, 48, 64, 128, 256];
  const images = [];
  for (const size of sizes) {
    const file = path.join(temporary, `${size}.png`);
    resize(size, file);
    images.push(await readFile(file));
  }
  const header = Buffer.alloc(6 + sizes.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  images.forEach((png, index) => {
    const entry = 6 + index * 16;
    header[entry] = sizes[index] % 256;
    header[entry + 1] = sizes[index] % 256;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  await writeFile(
    "electron/icons/jeeves.ico",
    Buffer.concat([header, ...images]),
  );
  console.log("Built Jeeves icons for macOS, Windows, Linux, and the web.");
} finally {
  await rm(temporary, { recursive: true, force: true });
}
