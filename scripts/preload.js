const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {

  startObjectWorker: () => ipcRenderer.invoke("start-object-worker"),
  
  sendObjectFrame: (frame) => ipcRenderer.send("object-frame", frame),
  
  onObjectResult: (cb) => ipcRenderer.on("object-result", (_, data) => cb(data))
});