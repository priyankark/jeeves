# First things first, Jeeves

Let us get something done before anyone asks you for an API key.

## Install the desktop app

Choose your system on the [GitHub releases page](https://github.com/priyankark/jeeves/releases). The current preview is **0.1.0-preview.11**. Desktop users do not need Node.js or npm.

### Mac

1. Choose `mac-arm64.dmg` for an Apple Silicon Mac or `mac-x64.dmg` for an Intel Mac. **Apple menu → About This Mac** shows your chip or processor.
2. Open the DMG and drag Jeeves into **Applications**.
3. Open Jeeves from Applications.

Mac downloads from preview.11 onward are signed with Developer ID and notarized by Apple. The first launch may ask you to confirm opening an app downloaded from the internet. If macOS reports a damaged app or an unverified developer, stop and [report the exact message](https://github.com/priyankark/jeeves/issues/new?template=bug_report.yml), including the version and your Mac model. Do not disable Gatekeeper or remove quarantine to bypass that warning.

### Windows

Download the `win-x64.exe` installer, run it, choose the install location, and open Jeeves from Start. Installation is per user. These preview builds do not have a trusted publisher signature, so Windows may show an unknown-publisher warning. Confirm the file came from this repository before proceeding. A managed computer may require administrator approval.

### Linux

For Debian or Ubuntu x64, download the `.deb` and install it with your package manager. For example, from the download folder:

```sh
sudo apt install ./Jeeves-0.1.0-preview.11-linux-amd64.deb
```

For other x64 Linux desktops, download the AppImage, make it executable, and open it:

```sh
chmod +x Jeeves-0.1.0-preview.11-linux-x86_64.AppImage
./Jeeves-0.1.0-preview.11-linux-x86_64.AppImage
```

Some systems require FUSE support for AppImages. Use the Debian package on a supported distribution if that is simpler. An ARM Linux or Windows ARM build is not provided in this preview.

### Check a download

Each release includes `SHA256SUMS.txt` and an individual `.sha256` file for every installer. Compare the hash of the file you downloaded with its entry. Replace `YOUR_INSTALLER` with the actual filename:

```sh
# macOS
shasum -a 256 YOUR_INSTALLER
# Linux
sha256sum YOUR_INSTALLER
```

On Windows, use PowerShell:

```powershell
Get-FileHash .\YOUR_INSTALLER -Algorithm SHA256
```

Checksums detect a changed or incomplete download. They are separate from publisher signing.

## Try the example without keys

1. Choose **Try the example** on the welcome screen. You can also find it on Home.
2. Review the sample project notes.
3. Select **Run demo**.
4. Read the weekly update, download it, or open **Inspect run** to see each step.

The sample runs through the workflow engine and shows a prepared, labeled result. No AI service is called. Editing the sample in Demo mode shows simulation details; switch to Live when you want a generated answer to your own task.

## Connect an AI service

Choose **Set up my AI connections** from the welcome screen. If you skipped setup, use **Home → Set up AI** or **Settings**.

For writing and analysis, choose one agent service:

| Service     | Setup                                                                                                                                                                      |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenAI      | Paste your API key, keep or choose a model, then select **Save and verify**. The form links to the provider's key page.                                                    |
| Codex       | Install and log in to the Codex CLI on this computer, then choose **Use CLI login → Save and verify**.                                                                     |
| OpenRouter  | Paste your API key and choose an available model, then select **Save and verify**.                                                                                         |
| Local model | Start an OpenAI-compatible server, enter its `/v1` endpoint and exact model name, then select **Save and verify**. Its key is optional if the server does not require one. |

For Jev decisions, connect **Jev · TypeSafe** with a TypeSafe API key. Live Jev access is managed by TypeSafe. A workflow with Jev and agent steps needs both connections. A simple writing workflow can use just an agent service.

**Verified** means the connection check succeeded. **Check failed** means you should correct the key, login, endpoint, or model before running live work. The form keeps the error visible. Provider charges and account access are managed by the provider.

Saved keys are kept in a local settings file with owner-only permissions. That file is not encrypted. Do not paste API keys, passwords, or payment details into workflow input fields.

## Use your own notes

After the sample, choose **Use my own notes**. Enter a project name and your notes. Connect an agent service if needed and select **Run live**. Review the output before sharing it.

For a branching example, open **Explore → Request triage · Jev** and add it to your library. Urgent and routine requests take different routes. Missing detail or low confidence leads to a question for you. A waiting run stays saved until you answer or stop it. Optional sound alerts are available in Settings.

Browser workflows also need Google Chrome. Enter website passwords and MFA in the browser when Jeeves hands control to you. Return to the saved request and explicitly continue once you are done. Opening an alert or browser does not resume the workflow.

## Run from source

Requires Git, Node.js **22.12 or newer**, and npm. Quit the desktop app and any other Jeeves engine first. The development API uses port 4317 and the web UI uses 5173.

```sh
git clone https://github.com/priyankark/jeeves.git
cd jeeves
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. The same welcome screen and sample are available. You can save provider connections through the UI. An optional `.env` file can be created from `.env.example`; changing it requires a server restart. Keep it out of Git.

Press **Ctrl+C** to stop the development servers before choosing another mode:

| Mode                 | Command                           | Open                                 |
| -------------------- | --------------------------------- | ------------------------------------ |
| Desktop app          | `npm run desktop`                 | A desktop window opens automatically |
| Desktop development  | `npm run desktop:dev`             | A desktop window with hot reload     |
| Production web       | `npm run build`, then `npm start` | http://127.0.0.1:4317                |
| Package an installer | `npm run package:installer`       | Files under `release/installers/`    |

## If something is amiss

| What you see                                   | What to try                                                                                                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| “Address already in use” or an old app version | Quit Jeeves from its application or tray menu and stop other development servers. Closing the window can leave the engine running. Then start one copy. |
| No live provider available                     | Open **Home → Set up AI**. Connect and verify a service, then check the provider chosen for the workflow's agent steps.                                 |
| Local model verification fails                 | Check that the server is running, its endpoint ends in `/v1`, and the exact model is installed.                                                         |
| Browser asks for a login                       | Complete the login in its browser window, then answer the pending request in Jeeves.                                                                    |
| Browser action cannot continue                 | Read the saved screenshot and error, open the saved browser if offered, and review the page before retrying.                                            |
| Run is waiting                                 | Open **Activity** and answer the input request. It is deliberately paused.                                                                              |
| AppImage does not open                         | Check execute permissions and your distribution's FUSE requirements, or use the `.deb` on Debian/Ubuntu.                                                |

Still stuck? [Open a bug report](https://github.com/priyankark/jeeves/issues/new?template=bug_report.yml) with your app version, operating system, steps, and the visible error. Remove keys and private task data from screenshots and logs.

## Updates and your workspace

Updates are manual. Quit Jeeves, download the new installer, and replace the app. The workspace is separate from the app bundle. Keep a backup before trying a preview.

Packaged desktop workspaces live under the operating system's application-data folder. On Mac, the default is `~/Library/Application Support/jeeves/workspace`. Source development uses `.jeeves/` in the checkout. `JEEVES_DATA_DIR` can select another folder. Workflow history may contain private task data; exclude it from bug reports and public repositories.

[Back to the project](../README.md) · [Full user guide](USER_GUIDE.md) · [Contribute](../CONTRIBUTING.md)
