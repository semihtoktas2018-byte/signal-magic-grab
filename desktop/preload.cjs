const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("keltosDesktop", {
  getWebUrl: () => ipcRenderer.invoke("keltos:get-web-url"),
  saveWebUrl: (url) => ipcRenderer.invoke("keltos:save-web-url", url)
});
