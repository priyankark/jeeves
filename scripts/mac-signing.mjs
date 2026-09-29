import { access } from "node:fs/promises";
import { execFileSync } from "node:child_process";

export function macSigningConfig(
  env = process.env,
  platform = process.platform,
) {
  if (platform !== "darwin") return null;
  const enabled = env.JEEVES_SIGN_MAC;
  if (enabled && !["true", "false"].includes(enabled))
    throw new Error("JEEVES_SIGN_MAC must be true or false");
  if (enabled !== "true") return null;
  const required = [
    "JEEVES_MAC_IDENTITY",
    "JEEVES_NOTARY_KEY_FILE",
    "JEEVES_NOTARY_KEY_ID",
    "JEEVES_NOTARY_ISSUER_ID",
  ];
  const missing = required.filter((key) => !env[key]?.trim());
  if (missing.length)
    throw new Error(`Signed Mac release requires: ${missing.join(", ")}`);
  if (!env.JEEVES_MAC_IDENTITY.startsWith("Developer ID Application: "))
    throw new Error(
      "A Developer ID Application identity is required for public distribution",
    );
  return {
    identity: env.JEEVES_MAC_IDENTITY,
    keychain: env.JEEVES_MAC_KEYCHAIN || undefined,
    appleApiKey: env.JEEVES_NOTARY_KEY_FILE,
    appleApiKeyId: env.JEEVES_NOTARY_KEY_ID,
    appleApiIssuer: env.JEEVES_NOTARY_ISSUER_ID,
  };
}
export async function signMacApp(app, config) {
  await access(config.appleApiKey);
  const { sign } = await import("@electron/osx-sign");
  const { notarize } = await import("@electron/notarize");
  await sign({
    app,
    identity: config.identity,
    keychain: config.keychain,
    platform: "darwin",
    type: "distribution",
  });
  execFileSync("codesign", ["--verify", "--deep", "--strict", app], {
    stdio: "inherit",
  });
  await notarize({
    appPath: app,
    appleApiKey: config.appleApiKey,
    appleApiKeyId: config.appleApiKeyId,
    appleApiIssuer: config.appleApiIssuer,
  });
  execFileSync("xcrun", ["stapler", "validate", app], { stdio: "inherit" });
  execFileSync("spctl", ["--assess", "--type", "execute", "--verbose=2", app], {
    stdio: "inherit",
  });
  console.log("Mac app is signed, notarized, and accepted by Gatekeeper.");
}
export async function signMacDmg(file, config) {
  await access(config.appleApiKey);
  const keychain = config.keychain ? ["--keychain", config.keychain] : [];
  execFileSync(
    "codesign",
    ["--force", "--sign", config.identity, ...keychain, "--timestamp", file],
    { stdio: "inherit" },
  );
  const response = JSON.parse(
    execFileSync(
      "xcrun",
      [
        "notarytool",
        "submit",
        file,
        "--key",
        config.appleApiKey,
        "--key-id",
        config.appleApiKeyId,
        "--issuer",
        config.appleApiIssuer,
        "--wait",
        "--timeout",
        "15m",
        "--output-format",
        "json",
      ],
      { encoding: "utf8", timeout: 16 * 60 * 1000 },
    ),
  );
  if (response.status !== "Accepted")
    throw new Error(
      `DMG notarization was not accepted: ${response.status}; submission ${response.id}`,
    );
  execFileSync("xcrun", ["stapler", "staple", file], { stdio: "inherit" });
  execFileSync("xcrun", ["stapler", "validate", file], { stdio: "inherit" });
  execFileSync("codesign", ["--verify", "--strict", file], {
    stdio: "inherit",
  });
  console.log("Mac disk image is signed and notarized.");
}
