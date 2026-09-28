const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("jeevesDesktop", {
  notify: (notice) => ipcRenderer.invoke("jeeves:notify", notice),
  onNotificationClick: (callback) => {
    const listener = (_event, id) => callback(id);
    ipcRenderer.on("jeeves:notification-click", listener);
    return () =>
      ipcRenderer.removeListener("jeeves:notification-click", listener);
  },
});
