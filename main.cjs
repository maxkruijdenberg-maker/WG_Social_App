const { app, BrowserWindow, ipcMain, dialog, safeStorage } = require('electron');
const { readFile, writeFile } = require('node:fs/promises');
const path = require('node:path');
const { createMontage, runFfmpeg } = require('./montage.cjs');
const { createKeyStore, requestText } = require('./openai.cjs');
const { createRtf } = require('./document.cjs');
const { addVideoTemplate, getVideoTemplate, listVideoTemplates, videoType } = require('./video-templates.cjs');

let selectedVideo;
let montage;

function ffmpegBinary() {
  return app.isPackaged && process.platform === 'win32'
    ? path.join(process.resourcesPath, 'ffmpeg', 'ffmpeg.exe')
    : require('@ffmpeg-installer/ffmpeg').path;
}

function pickVideo() {
  return dialog.showOpenDialog({
    properties: ['openFile'], filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'webm', 'm4v'] }]
  });
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1470, height: 980, minWidth: 880, minHeight: 640,
    show: false,
    backgroundColor: '#f2f5fa', autoHideMenuBar: true,
    icon: path.join(__dirname, 'ui', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), sandbox: true }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.once('ready-to-show', () => {
    window.maximize();
    window.show();
  });
  window.loadFile('ui/index.html');
}

ipcMain.handle('save-image', async (_, bytes) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: 'WG-social-post.png', filters: [{ name: 'PNG-afbeelding', extensions: ['png'] }]
  });
  if (canceled) return false;
  await writeFile(filePath, Buffer.from(bytes));
  return true;
});

ipcMain.handle('open-video', async () => {
  const { canceled, filePaths } = await pickVideo();
  if (canceled) return null;
  const bytes = await readFile(filePaths[0]);
  selectedVideo = filePaths[0];
  montage = undefined;
  return { bytes, name: path.basename(selectedVideo), type: videoType(selectedVideo) };
});

ipcMain.handle('export-video', async (_, { start, end, muted }) => {
  const input = selectedVideo;
  if (!input) throw new Error('Open eerst een video.');
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) {
    throw new Error('Kies een geldig begin- en eindpunt.');
  }
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: 'WG-social-video.mp4', filters: [{ name: 'MP4-video', extensions: ['mp4'] }]
  });
  if (canceled) return false;
  if (path.resolve(input).toLowerCase() === path.resolve(filePath).toLowerCase()) {
    throw new Error('Kies een andere bestandsnaam dan die van de ingeladen video.');
  }
  const args = ['-nostdin', '-y', '-ss', String(start), '-i', input, '-t', String(end - start),
    '-map', '0:v:0', '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p'];
  args.push(...(muted ? ['-an'] : ['-map', '0:a:0?', '-c:a', 'aac']));
  args.push('-movflags', '+faststart', filePath);
  const result = await runFfmpeg(ffmpegBinary(), args);
  if (result.code !== 0) throw new Error(result.stderr.slice(-1800));
  return true;
});

function keyStore() {
  return createKeyStore(safeStorage, path.join(app.getPath('userData'), 'openai-key.bin'), process.env.OPENAI_API_KEY?.trim());
}

ipcMain.handle('api-key-status', () => keyStore().status());
ipcMain.handle('save-api-key', (_, key) => keyStore().save(key));
ipcMain.handle('clear-api-key', () => keyStore().clear());

ipcMain.handle('write-text', async (_, { prompt, mode }) => {
  const instruction = mode === 'document'
    ? 'Je schrijft zakelijke Nederlandstalige documenten voor WG Makelaars. Gebruik heldere alinea’s, tussenkoppen met ## en desgewenst opsommingen met -. Laat de titel weg; de app voegt die toe. Gebruik alleen aangeleverde feiten. Noteer ontbrekende essentiële gegevens als [invullen]. Geef alleen het conceptdocument, zonder codeblokken.'
    : 'Je schrijft Nederlandstalige socialmediaberichten voor WG Makelaars. Verzin geen woningdetails. Geef alleen de voorgestelde tekst.';
  return requestText(await keyStore().requireKey(), { instructions: instruction, input: prompt });
});

ipcMain.handle('save-document', async (_, { title, body }) => {
  if (typeof body !== 'string' || !body.trim()) throw new Error('Er is geen conceptdocument om op te slaan.');
  const documentTitle = typeof title === 'string' ? title.trim().slice(0, 100) || 'WG Makelaars' : 'WG Makelaars';
  const filename = documentTitle.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/[. ]+$/, '') || 'WG-document';
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: filename + '.rtf', filters: [{ name: 'Word-compatibel document', extensions: ['rtf'] }]
  });
  if (canceled) return false;
  await writeFile(filePath, createRtf(documentTitle, body), 'utf8');
  return true;
});

function videoLibraryPath() {
  return path.join(app.getPath('userData'), 'video-templates');
}

ipcMain.handle('list-video-templates', () => listVideoTemplates(videoLibraryPath()));

ipcMain.handle('import-video-template', async (_, fields) => {
  const { canceled, filePaths } = await pickVideo();
  return canceled ? null : addVideoTemplate(videoLibraryPath(), filePaths[0], fields);
});

ipcMain.handle('preview-video-template', async (_, id) => {
  const template = await getVideoTemplate(videoLibraryPath(), id);
  return { bytes: await readFile(template.file), type: template.type };
});

ipcMain.handle('generate-montage', async (_, { prompt, showLogo, templateId, address, city, contact, animateCards }) => {
  const source = selectedVideo;
  if (!source) throw new Error('Laad eerst de video die je wilt bewerken.');
  const reference = await getVideoTemplate(videoLibraryPath(), templateId);
  const token = await keyStore().requireKey();
  const assets = path.join(app.isPackaged ? process.resourcesPath : __dirname, 'ui');
  const graphics = animateCards ? { address, city, contact } : undefined;
  const result = await createMontage(ffmpegBinary(), source, reference.file, prompt, token,
    showLogo ? path.join(assets, 'icon.png') : undefined, graphics);
  if (source === selectedVideo) montage = { bytes: result.bytes, source, reference: reference.file };
  return result;
});

ipcMain.handle('save-montage', async () => {
  const output = montage;
  if (!output) throw new Error('Maak eerst een AI-montage.');
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: 'WG-AI-montage.mp4', filters: [{ name: 'MP4-video', extensions: ['mp4'] }]
  });
  if (canceled) return false;
  if ([output.source, output.reference].some(input => path.resolve(input).toLowerCase() === path.resolve(filePath).toLowerCase())) {
    throw new Error('Kies een andere bestandsnaam dan die van de ingeladen video of het template.');
  }
  await writeFile(filePath, output.bytes);
  return true;
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
