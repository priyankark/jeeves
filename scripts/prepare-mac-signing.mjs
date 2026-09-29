import { mkdir, writeFile, appendFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";

if (process.platform !== "darwin" || process.env.GITHUB_ACTIONS !== "true")
  throw new Error(
    "This helper prepares an ephemeral GitHub Actions Mac keychain only",
  );
const required = [
  "RUNNER_TEMP",
  "GITHUB_ENV",
  "MAC_CERTIFICATE_P12_BASE64",
  "MAC_CERTIFICATE_PASSWORD",
  "MAC_SIGNING_IDENTITY",
  "APPLE_NOTARY_KEY_BASE64",
  "APPLE_NOTARY_KEY_ID",
  "APPLE_NOTARY_ISSUER_ID",
];
const missing = required.filter((key) => !process.env[key]);
if (missing.length)
  throw new Error(`Missing signing settings: ${missing.join(", ")}`);
const dir = path.join(process.env.RUNNER_TEMP, "jeeves-signing");
await mkdir(dir, { recursive: true, mode: 0o700 });
const certificate = path.join(dir, "certificate.p12");
const key = path.join(dir, "notary.p8");
const keychain = path.join(dir, "signing.keychain-db");
await writeFile(
  certificate,
  Buffer.from(process.env.MAC_CERTIFICATE_P12_BASE64, "base64"),
  { mode: 0o600 },
);
await writeFile(
  key,
  Buffer.from(process.env.APPLE_NOTARY_KEY_BASE64, "base64"),
  { mode: 0o600 },
);
const password = randomBytes(32).toString("hex");
const security = (args) => execFileSync("security", args, { stdio: "pipe" });
try {
  const originalKeychains = security(["list-keychains", "-d", "user"])
    .toString()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  await writeFile(
    path.join(dir, "original-keychains.json"),
    JSON.stringify(originalKeychains),
    { mode: 0o600 },
  );
  security(["create-keychain", "-p", password, keychain]);
  security(["set-keychain-settings", "-lut", "21600", keychain]);
  security(["unlock-keychain", "-p", password, keychain]);
  security([
    "import",
    certificate,
    "-P",
    process.env.MAC_CERTIFICATE_PASSWORD,
    "-k",
    keychain,
    "-T",
    "/usr/bin/codesign",
    "-T",
    "/usr/bin/security",
  ]);
  security([
    "set-key-partition-list",
    "-S",
    "apple-tool:,apple:,codesign:",
    "-s",
    "-k",
    password,
    keychain,
  ]);
  // codesign also searches this list for the private key, even with --keychain.
  security([
    "list-keychains",
    "-d",
    "user",
    "-s",
    keychain,
    ...originalKeychains,
  ]);
} catch {
  // Do not let child-process exceptions print command arguments containing passwords.
  throw new Error("Could not prepare the temporary Mac signing keychain");
}
const settings = {
  JEEVES_MAC_IDENTITY: process.env.MAC_SIGNING_IDENTITY,
  JEEVES_MAC_KEYCHAIN: keychain,
  JEEVES_NOTARY_KEY_FILE: key,
  JEEVES_NOTARY_KEY_ID: process.env.APPLE_NOTARY_KEY_ID,
  JEEVES_NOTARY_ISSUER_ID: process.env.APPLE_NOTARY_ISSUER_ID,
};
for (const value of Object.values(settings))
  if (/[\r\n]/.test(value))
    throw new Error("Invalid multiline signing setting");
await appendFile(
  process.env.GITHUB_ENV,
  Object.entries(settings)
    .map(([key, value]) => `${key}=${value}\n`)
    .join(""),
);
console.log(
  "Prepared temporary signing keychain and notarization credentials.",
);
