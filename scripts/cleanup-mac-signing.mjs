import { rm, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
if (
  process.platform !== "darwin" ||
  process.env.GITHUB_ACTIONS !== "true" ||
  !process.env.RUNNER_TEMP
)
  throw new Error(
    "This helper cleans up an ephemeral GitHub Actions Mac keychain only",
  );
const dir = path.join(process.env.RUNNER_TEMP, "jeeves-signing");
try {
  const original = JSON.parse(
    await readFile(path.join(dir, "original-keychains.json"), "utf8"),
  );
  execFileSync(
    "security",
    ["list-keychains", "-d", "user", "-s", ...original],
    { stdio: "ignore" },
  );
} catch (error) {
  if (error.code !== "ENOENT")
    console.warn("Could not restore the original keychain search list.");
}
try {
  execFileSync(
    "security",
    ["delete-keychain", path.join(dir, "signing.keychain-db")],
    { stdio: "ignore" },
  );
} catch {
  /* Setup may have failed before keychain creation. */
}
await rm(dir, { recursive: true, force: true });
console.log("Removed temporary Mac signing credentials.");
