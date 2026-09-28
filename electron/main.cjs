const {
  app,
  BrowserWindow,
  shell,
  screen,
  dialog,
  Tray,
  Menu,
  nativeImage,
  Notification,
  ipcMain,
} = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");
const { homedir } = require("node:os");
const root = path.resolve(__dirname, "..");
let backend;
let tray;
let mainWindow;
let quitting = false;
const notifications = new Map();
ipcMain.handle("jeeves:notify", (event, notice) => {
  if (
    !mainWindow ||
    event.sender !== mainWindow.webContents ||
    event.senderFrame !== mainWindow.webContents.mainFrame ||
    !Notification.isSupported()
  )
    return false;
  if (
    !notice ||
    typeof notice.id !== "string" ||
    typeof notice.title !== "string" ||
    typeof notice.body !== "string" ||
    notice.id.length > 160 ||
    notice.title.length > 120 ||
    notice.body.length > 300
  )
    return false;
  notifications.get(notice.id)?.close();
  const notification = new Notification({
    title: notice.title,
    body: notice.body,
    silent: true,
  });
  notifications.set(notice.id, notification);
  if (notifications.size > 30) {
    const oldest = notifications.keys().next().value;
    notifications.get(oldest)?.close();
    notifications.delete(oldest);
  }
  notification.on("click", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send("jeeves:notification-click", notice.id);
  });
  notification.on("close", () => notifications.delete(notice.id));
  notification.show();
  return true;
});
if (!app.requestSingleInstanceLock()) app.quit();
app.on("second-instance", () => {
  mainWindow?.show();
  mainWindow?.focus();
});
app.on("activate", () => {
  mainWindow?.show();
});
const development = process.argv.includes("--dev");
const port = Number(process.env.JEEVES_PORT || 4317);
async function healthy() {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/status`, {
      signal: AbortSignal.timeout(1000),
    });
    const data = await r.json();
    return r.ok && data.providers && data.version;
  } catch {
    return false;
  }
}
async function startBackend() {
  if (await healthy()) return;
  backend = spawn(
    process.execPath,
    [path.join(root, "runtime", "server.mjs")],
    {
      cwd: root,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        PATH: [
          process.env.PATH,
          path.join(homedir(), ".local", "bin"),
          "/opt/homebrew/bin",
          "/usr/local/bin",
        ]
          .filter(Boolean)
          .join(path.delimiter),
        PORT: String(port),
        ...(app.isPackaged
          ? {
              JEEVES_DATA_DIR:
                process.env.JEEVES_DATA_DIR ||
                path.join(app.getPath("userData"), "workspace"),
            }
          : {}),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let failure = "";
  backend.stderr.on("data", (chunk) => {
    failure = (failure + chunk).slice(-1500);
  });
  backend.on("error", (error) => {
    failure = error.message;
  });
  for (let i = 0; i < 60; i++) {
    if (await healthy()) return;
    if (backend.exitCode !== null)
      throw new Error(`The local engine could not start. ${failure}`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(
    "The local engine did not become ready. Check whether another application is using port 4317.",
  );
}
app.whenReady().then(async () => {
  try {
    const appIcon = nativeImage.createFromPath(
      path.join(__dirname, "icons", "jeeves.png"),
    );
    if (process.platform === "darwin") app.dock.setIcon(appIcon);
    if (!development) await startBackend();
    const area = screen.getPrimaryDisplay().workAreaSize;
    const win = new BrowserWindow({
      width: Math.min(1600, area.width),
      height: Math.min(1000, area.height),
      minWidth: Math.min(960, area.width),
      minHeight: Math.min(700, area.height),
      title: "Jeeves",
      icon: appIcon,
      backgroundColor: "#f7f8f5",
      show: false,
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });
    mainWindow = win;
    if (process.platform === "darwin") {
      tray = new Tray(nativeImage.createEmpty());
      tray.setTitle("j.");
      tray.setToolTip("Jeeves · workflow engine running");
      tray.setContextMenu(
        Menu.buildFromTemplate([
          {
            label: "Open Jeeves",
            click: () => {
              win.show();
              win.focus();
            },
          },
          { label: "Schedules run while Jeeves is open", enabled: false },
          { type: "separator" },
          { label: "Quit Jeeves and stop scheduling", click: () => app.quit() },
        ]),
      );
      win.on("close", (event) => {
        if (!quitting) {
          event.preventDefault();
          win.hide();
        }
      });
    }
    const origin = development
      ? "http://127.0.0.1:5173"
      : `http://127.0.0.1:${port}`;
    win.once("ready-to-show", () => win.show());
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https:\/\//.test(url)) shell.openExternal(url);
      return { action: "deny" };
    });
    win.webContents.on("will-navigate", (event, url) => {
      if (new URL(url).origin !== origin) event.preventDefault();
    });
    win.webContents.session.setPermissionRequestHandler(
      (_webContents, _permission, callback) => callback(false),
    );
    await win.loadURL(origin);
  } catch (error) {
    dialog.showErrorBox("Jeeves could not start", error.message);
    app.quit();
  }
});
app.on("before-quit", () => {
  quitting = true;
  if (backend && !backend.killed) backend.kill("SIGTERM");
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
