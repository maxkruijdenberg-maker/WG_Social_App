const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  saveImage: bytes => ipcRenderer.invoke('save-image', bytes),
  openVideo: () => ipcRenderer.invoke('open-video'),
  exportVideo: options => ipcRenderer.invoke('export-video', options),
  listVideoTemplates: () => ipcRenderer.invoke('list-video-templates'),
  importVideoTemplate: fields => ipcRenderer.invoke('import-video-template', fields),
  previewVideoTemplate: id => ipcRenderer.invoke('preview-video-template', id),
  generateMontage: options => ipcRenderer.invoke('generate-montage', options),
  saveMontage: () => ipcRenderer.invoke('save-montage'),
  apiKeyStatus: () => ipcRenderer.invoke('api-key-status'),
  saveApiKey: key => ipcRenderer.invoke('save-api-key', key),
  clearApiKey: () => ipcRenderer.invoke('clear-api-key'),
  saveDocument: options => ipcRenderer.invoke('save-document', options),
  writeText: options => ipcRenderer.invoke('write-text', options)
});
