const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  saveImage: bytes => ipcRenderer.invoke('save-image', bytes),
  openVideo: () => ipcRenderer.invoke('open-video'),
  exportVideo: options => ipcRenderer.invoke('export-video', options),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  listVideoTemplates: () => ipcRenderer.invoke('list-video-templates'),
  importVideoTemplate: fields => ipcRenderer.invoke('import-video-template', fields),
  previewVideoTemplate: id => ipcRenderer.invoke('preview-video-template', id),
  generateMontage: options => ipcRenderer.invoke('generate-montage', options),
  saveMontage: () => ipcRenderer.invoke('save-montage'),
  connectSocial: options => ipcRenderer.invoke('connect-social', options),
  publishSocial: options => ipcRenderer.invoke('publish-social', options),
  saveDocument: options => ipcRenderer.invoke('save-document', options),
  writeText: options => ipcRenderer.invoke('write-text', options)
});
