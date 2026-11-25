const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  saveImage: bytes => ipcRenderer.invoke('save-image', bytes),
  openVideo: () => ipcRenderer.invoke('open-video'),
  exportVideo: options => ipcRenderer.invoke('export-video', options),
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),
  openVideoReference: () => ipcRenderer.invoke('open-video-reference'),
  generateMontage: options => ipcRenderer.invoke('generate-montage', options),
  saveMontage: () => ipcRenderer.invoke('save-montage'),
  connectSocial: options => ipcRenderer.invoke('connect-social', options),
  publishSocial: options => ipcRenderer.invoke('publish-social', options),
  writeText: options => ipcRenderer.invoke('write-text', options)
});
