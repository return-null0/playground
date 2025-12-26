require('dotenv').config();
const { app, BrowserWindow, utilityProcess, ipcMain } = require('electron');
const path = require("path");

const iconPath = path.join(__dirname, 'imgs', 'icon.jpg');

//  PERFORMANCE FLAGS 
app.commandLine.appendSwitch('enable-unsafe-webgpu');
app.commandLine.appendSwitch('enable-features', 'SharedArrayBuffer');

app.setName('AI Playground');

let mainWindow = null;
let objDetectionWorker = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    title: "AI Playground",
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "scripts/preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      nodeIntegrationInWorker: true
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('closed', () => {
    mainWindow = null;

    if (objDetectionWorker) objDetectionWorker.kill();
  });
};

  function getModelPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "models", "image");
  } else {
    return path.join(__dirname, "..", "models", "image");
  }
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    app.dock.setIcon(iconPath);
  }
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});


ipcMain.handle("start-object-worker", () => {
  // Reuse existing worker if user navigated away and came back
  if (objDetectionWorker) return;

  objDetectionWorker = utilityProcess.fork(
    path.join(__dirname, "scripts/objDetectionWorker.js"),
    [],
    {     stdio: "pipe",
    env: {
      ...process.env,
      MODEL_DIR: getModelPath()
    }}
  );

  objDetectionWorker.stdout.on('data', (data) => console.log(`[Worker]: ${data}`));
  objDetectionWorker.stderr.on('data', (data) => console.error(`[Worker Err]: ${data}`));

  objDetectionWorker.on("message", (msg) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("object-result", msg);
    }
  });

  objDetectionWorker.on("exit", () => { objDetectionWorker = null; });
  console.log("Object detection worker started");
});


ipcMain.on('log-to-terminal', (event, msg) => {
  console.log(`📝 [Renderer]: ${msg}`);
});

ipcMain.on("object-frame", (_, frame) => {
  if (objDetectionWorker) objDetectionWorker.postMessage(frame);
});