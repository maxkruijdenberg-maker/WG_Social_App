const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  saveImage: bytes => ipcRenderer.invoke('save-image', bytes),
  openVideo: () => ipcRenderer.invoke('open-video'),
  exportVideo: options => ipcRenderer.invoke('export-video', options),
  writeText: options => ipcRenderer.invoke('write-text', options)
});
