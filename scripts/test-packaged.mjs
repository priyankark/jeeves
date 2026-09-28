import { _electron as electron } from "playwright-core";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import path from "node:path";
import assert from "node:assert/strict";

const folder = path.resolve(
  `release/Jeeves-${process.platform}-${process.arch}`,
);
const executablePath =
  process.platform === "darwin"
    ? path.join(folder, "Jeeves.app/Contents/MacOS/Jeeves")
    : path.join(folder, process.platform === "win32" ? "Jeeves.exe" : "Jeeves");
const resources =
  process.platform === "darwin"
    ? path.join(folder, "Jeeves.app/Contents/Resources/app")
    : path.join(folder, "resources/app");
assert.deepEqual(
  (await readdir(resources)).sort(),
  [
    "LICENSE",
    "dist",
    "electron",
    "marketplace",
    "package.json",
    "runtime",
  ].sort(),
);
await readFile(
  path.join(resources, "runtime/node_modules/playwright-core/package.json"),
);
const { version } = JSON.parse(await readFile("package.json", "utf8"));
assert.equal(
  JSON.parse(await readFile(path.join(resources, "package.json"), "utf8"))
    .version,
  version,
);

const temporary = await mkdtemp(path.join(tmpdir(), "jeeves-release-smoke-"));
const userData = path.join(temporary, "desktop");
await mkdir(userData);
const socket = createServer();
await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
const port = socket.address().port;
await new Promise((resolve) => socket.close(resolve));
const env = {
  ...process.env,
  JEEVES_PORT: String(port),
  JEEVES_USER_DATA_DIR: userData,
  JEEVES_DATA_DIR: path.join(temporary, "workspace"),
  TYPESAFE_API_KEY: "",
  OPENAI_API_KEY: "",
  OPENROUTER_API_KEY: "",
  LOCAL_MODEL: "",
  LOCAL_API_KEY: "",
  ENABLE_CODEX: "false",
};
delete env.ELECTRON_RUN_AS_NODE;
let app;
try {
  app = await electron.launch({
    executablePath,
    cwd: temporary,
    env,
    args: process.platform === "linux" ? ["--no-sandbox"] : [],
    timeout: 60000,
  });
  const page = await app.firstWindow({ timeout: 60000 });
  await page
    .getByRole("button", { name: "Try the example", exact: true })
    .waitFor();
  assert.equal(await app.evaluate(({ app }) => app.getVersion()), version);
  const status = await fetch(`http://127.0.0.1:${port}/api/status`).then(
    (response) => response.json(),
  );
  assert.equal(status.version, version);
  assert.equal(await app.evaluate(({ app }) => app.isPackaged), true);
  assert.equal(await page.evaluate(() => typeof window.require), "undefined");
  await page
    .getByRole("button", { name: "Try the example", exact: true })
    .click();
  await page.getByRole("button", { name: "Run demo", exact: true }).click();
  await page
    .getByRole("heading", {
      name: "Customer portal — weekly update",
      exact: true,
    })
    .waitFor();
  const result = await page
    .getByRole("region", { name: "Chat run result" })
    .innerText();
  assert.match(result, /No AI was called/);
  await page.screenshot({
    path: path.join(
      folder,
      "..",
      `packaged-smoke-${process.platform}-${process.arch}.png`,
    ),
  });
  const report = {
    version,
    platform: process.platform,
    arch: process.arch,
    packaged: true,
    checks: [
      "Allowlisted application files only",
      "Browser runtime bundled",
      "Packaged UI starts its own engine",
      "App and engine versions match the release",
      "Renderer Node access disabled",
      "Weekly update demo completes without credentials",
    ],
    testedAt: new Date().toISOString(),
  };
  await writeFile(
    path.join(
      folder,
      "..",
      `packaged-smoke-${process.platform}-${process.arch}.json`,
    ),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (app) await app.close();
  await rm(temporary, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 500,
  });
}
