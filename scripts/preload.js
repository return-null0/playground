const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {

  startObjectWorker: () => ipcRenderer.invoke("start-object-worker"),
  sendObjectFrame: (frame) => ipcRenderer.send("object-frame", frame),
  onObjectResult: (callback) => {

    const subscription = (_event, value) => callback(value);
    ipcRenderer.on("object-result", subscription);

    return () => ipcRenderer.removeListener("object-result", subscription);
  },

  env: {
    MODEL_ID: process.env.LLM_MODEL_ID
  },

  // (optional) Send logs to VS Code Terminal
  log: (msg) => ipcRenderer.send('log-to-terminal', msg)
});