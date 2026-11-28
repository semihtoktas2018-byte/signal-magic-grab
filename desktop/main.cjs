const { app, BrowserWindow, Menu, ipcMain, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

let mainWindow;
let setupWindow;

const userConfigPath = () => path.join(app.getPath("userData"), "config.json");
const packagedConfigPath = () => path.join(__dirname, "app-config.json");

function readConfiguredUrl() {
  try {
    const userConfig = JSON.parse(fs.readFileSync(userConfigPath(), "utf8"));
    if (userConfig.webUrl) return validateWebUrl(userConfig.webUrl);
  } catch {
    // No user override has been saved yet.
  }

  try {
    const packagedConfig = JSON.parse(fs.readFileSync(packagedConfigPath(), "utf8"));
    if (packagedConfig.webUrl) return validateWebUrl(packagedConfig.webUrl);
  } catch {
    // A first-run setup screen will be shown.
  }

  return null;
}

function validateWebUrl(value) {
  const parsed = new URL(String(value).trim());
  if (parsed.protocol !== "https:") {
    throw new Error("Market Analysis Terminal bağlantısı HTTPS olmalıdır.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Bağlantı adresinde kullanıcı adı veya parola bulunamaz.");
  }
  return parsed.toString();
}

function attachExternalLinkHandling(window) {
  window.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "https:" || parsed.protocol === "mailto:") {
        void shell.openExternal(url);
      }
    } catch {
      // Reject malformed or unsupported external URLs.
    }
    return { action: "deny" };
  });
}

function createMainWindow(url) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.loadURL(url);
    mainWindow.focus();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    title: "Market Analysis Terminal",
    backgroundColor: "#080d18",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false
    }
  });

  attachExternalLinkHandling(mainWindow);
  mainWindow.once("ready-to-show", () => mainWindow && mainWindow.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  void mainWindow.loadURL(url);
}

function createSetupWindow() {
  if (setupWindow && !setupWindow.isDestroyed()) {
    setupWindow.focus();
    return;
  }

  setupWindow = new BrowserWindow({
    width: 560,
    height: 520,
    minWidth: 480,
    minHeight: 460,
    resizable: false,
    title: "Market Analysis Terminal bağlantı ayarları",
    backgroundColor: "#080d18",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  setupWindow.on("closed", () => {
    setupWindow = null;
  });
  void setupWindow.loadFile(path.join(__dirname, "setup.html"));
}

ipcMain.handle("keltos:get-web-url", () => readConfiguredUrl() || "");

ipcMain.handle("keltos:save-web-url", (_event, rawUrl) => {
  const webUrl = validateWebUrl(rawUrl);
  fs.mkdirSync(path.dirname(userConfigPath()), { recursive: true });
  fs.writeFileSync(userConfigPath(), JSON.stringify({ webUrl }, null, 2), "utf8");

  if (setupWindow && !setupWindow.isDestroyed()) setupWindow.close();
  createMainWindow(webUrl);
  return { saved: true };
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: "Market Analysis Terminal",
      submenu: [
        { label: "Bağlantı ayarları", click: createSetupWindow },
        { type: "separator" },
        {
          label: "Yenile",
          accelerator: "F5",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.reloadIgnoringCache();
            }
          }
        },
        {
          label: "Yenile (Ctrl+R)",
          accelerator: "CmdOrCtrl+R",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.reloadIgnoringCache();
            }
          }
        },
        { role: "quit", label: "Çıkış" }
      ]
    }
  ]));

  const webUrl = readConfiguredUrl();
  if (webUrl) createMainWindow(webUrl);
  else createSetupWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const savedUrl = readConfiguredUrl();
      if (savedUrl) createMainWindow(savedUrl);
      else createSetupWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
