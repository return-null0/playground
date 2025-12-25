const { app, BrowserWindow, utilityProcess, ipcMain } = require('electron/main');
const path = require("path");

// Define mainWindow globally so we can access it inside IPC handlers
let mainWindow = null;
let objDetectionWorker = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "scripts/preload.js")
    }
  });

  mainWindow.loadFile('index.html');

  // Cleanup on close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

app.whenReady().then(() => {
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

/**
 * Start object detection worker
 */
ipcMain.handle("start-object-worker", () => {
  if (objDetectionWorker) return;


  objDetectionWorker = utilityProcess.fork(
    path.join(__dirname, "scripts/objDetectionWorker.js"),
    [],
    {
      stdio: "pipe"
    }
  );


  
  objDetectionWorker.stdout.on('data', (data) => {
    console.log(`[Worker STDOUT]: ${data.toString()}`);
  });

  objDetectionWorker.stderr.on('data', (data) => {
    console.error(`[Worker STDERR]: ${data.toString()}`);
  });
  

  objDetectionWorker.on("message", (msg) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("object-result", msg);
    }
  });

  objDetectionWorker.on("exit", (code) => {
    console.log("Object detection worker exited:", code);
    objDetectionWorker = null;
  });

  console.log("Object detection worker started");
});

//forward frames to worker

ipcMain.on("object-frame", (_, frame) => {
  if (!objDetectionWorker) return;
  objDetectionWorker.postMessage(frame);
});