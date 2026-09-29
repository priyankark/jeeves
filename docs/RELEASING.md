# Desktop installers and releases

The [Desktop installers workflow](../.github/workflows/release.yml) builds macOS Apple Silicon and Intel DMGs, a Windows x64 NSIS installer, and Linux x64 AppImage and Debian packages. Builds use native GitHub-hosted runners, the locked dependencies, and the committed Electron icons.

## Build locally

```sh
npm ci
npm run package:installer
npm run test:packaged
```

On Linux, run the smoke check under `xvfb-run --auto-servernum` if no display is available. Install Playwright's Chromium system dependencies first (`npx playwright install-deps chromium`). The Linux CI smoke test passes `--no-sandbox` to its test process because of hosted-runner sandbox restrictions; desktop installations do not add that flag.

Unpacked apps go under `release/Jeeves-<platform>-<arch>`. Installers and individual SHA-256 files go under `release/installers`. The packager copies an explicit allowlist of built assets into a temporary staging directory, keeping workspace data, credentials, source tests, and development dependencies out of the app. The bundled browser runtime is included.

The smoke check launches the actual packaged Electron executable from outside the repository, with a temporary user-data directory, workspace, and unused local port. It checks application contents, app version, renderer isolation, UI startup, and completion of the weekly-update sample. It saves a screenshot and JSON report under `release/` and then removes the temporary workspace. It does not use an existing Jeeves engine or real credentials.

## Publish a preview

1. Update the package version and lockfile with `npm version <version> --no-git-tag-version`. Update [release notes](RELEASE_NOTES.md).
2. Commit and push the changes. Keep the preview version label while the product is in early testing.
3. Tag that commit with the exact package version and push the tag:

   ```sh
   git tag v0.1.0-preview.1
   git push origin v0.1.0-preview.1
   ```

The tag must match `package.json`. The workflow calls the same CI checks used on branches, builds and smoke-tests all four targets, and checks all five installer hashes before creating a draft release with assets. Only after upload succeeds does it publish the preview. A rerun can finish a draft but refuses to replace an already published release. A failed platform build blocks publication.

For a build without publishing, select **Actions → Desktop installers → Run workflow** on a branch. Installer and smoke-test artifacts are retained for 14 days. Published release assets persist independently of the Actions artifact retention period.

## Current signing and access

Public Mac release tags require Developer ID signing and Apple notarization. The app is signed with hardened runtime, notarized, stapled, and assessed by Gatekeeper. The disk image is also signed, notarized, and stapled before checksums are calculated. A failure stops publication. Windows installers remain unsigned.

The repository administrator configures these GitHub Actions secrets:

- `MAC_CERTIFICATE_P12_BASE64`: encrypted Developer ID Application certificate and private key, encoded as base64.
- `MAC_CERTIFICATE_PASSWORD`: the export password for that P12.
- `MAC_SIGNING_IDENTITY`: the full Developer ID Application identity name.
- `APPLE_NOTARY_KEY_BASE64`: App Store Connect API private key, encoded as base64.
- `APPLE_NOTARY_KEY_ID` and `APPLE_NOTARY_ISSUER_ID`: identifiers for that key.

Mac runners import the identity into a temporary keychain, add it to the signing search list, and remove it and the decoded credentials in an always-run cleanup step. Never commit these files. Use a dedicated API key with the permissions required for notarization. Keep Apple Developer membership active and replace expiring or revoked credentials before releasing.

Ordinary local builds remain ad-hoc signed unless `JEEVES_SIGN_MAC=true` and the settings documented in `scripts/mac-signing.mjs` are supplied. For a signed branch build, set repository variable `MAC_SIGNING_ENABLED=true`. Public version tags always require signing, regardless of that variable.

The repository and published preview downloads are public. Automatic updates are not implemented; users download a newer installer and quit their current Jeeves app before replacing it.

The workflow uses [GitHub's native runner architectures](https://docs.github.com/en/actions/reference/runners/github-hosted-runners) and [electron-builder's distributable targets](https://www.electron.build/v26/docs/targets/).
