Jeeves desktop preview: turn repeat work into a workflow.

Start with **Try the example** to turn sample project notes into a weekly update without an API key. Add your own notes and connect one AI service when ready. Inspect and edit the steps, collect input during a run, and reuse the process.

## Choose your download

| System | Download | Install |
| --- | --- | --- |
| Mac with Apple Silicon (M-series) | `mac-arm64.dmg` | Open the disk image and drag Jeeves to Applications |
| Mac with Intel | `mac-x64.dmg` | Open the disk image and drag Jeeves to Applications |
| Windows x64 | `win-x64.exe` | Run the installer; installation is per user |
| Linux x64 (Debian/Ubuntu) | `linux-x64.deb` | Install with your package manager |
| Linux x64 (portable) | `linux-x64.AppImage` | Make executable and run; some systems require FUSE |

Node.js and npm are bundled/not required for desktop use. Browser workflows additionally need Google Chrome. Live AI services require their own credentials or a configured local model.

## Preview limitations

- These builds are not signed with a trusted publisher certificate or notarized. macOS Gatekeeper and Windows SmartScreen may require explicit approval. macOS builds have a local ad-hoc signature only. Use these previews only if you trust this repository and the attached checksums.
- Quit an older Jeeves build before opening the new one. Updates are manual; automatic updating is not implemented.
- Workflows, conversations, and provider settings stay in your local workspace. Installing an update does not intentionally replace them. Keep a backup before trying a preview.
- The repository is private: release downloads are available only to people who already have repository access.
- Packaged-app smoke tests cover startup, the isolated local engine, and the sample workflow on each platform. They do not establish real-provider answer quality or real retailer shopping reliability.

`SHA256SUMS.txt` and per-file `.sha256` files verify the attached downloads. Build provenance and packaged-app smoke reports are available in the **Desktop installers** Actions run for this tag.
