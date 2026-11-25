const { app, BrowserWindow, ipcMain, dialog, screen } = require('electron');
const { readFile, writeFile } = require('node:fs/promises');
const path = require('node:path');
const { createMontage, runFfmpeg } = require('./montage.cjs');
const social = require('./social.cjs');
const { createRtf } = require('./document.cjs');
const { addVideoTemplate, getVideoTemplate, listVideoTemplates, videoType } = require('./video-templates.cjs');

let selectedVideo;
let montage;
let connection;
let publishing = false;

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
    ...screen.getPrimaryDisplay().bounds,
    fullscreen: true,
    frame: false,
    backgroundColor: '#f2f5fa', autoHideMenuBar: true,
    icon: path.join(__dirname, 'ui', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), sandbox: true }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.on('leave-full-screen', () => window.setFullScreen(true));
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

ipcMain.handle('write-text', async (_, { prompt, key, mode }) => {
  const token = key?.trim() || process.env.OPENAI_API_KEY;
  if (!token) throw new Error('Vul je OpenAI API-sleutel in om ChatGPT te gebruiken.');
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      instructions: mode === 'document'
        ? 'Je schrijft zakelijke Nederlandstalige documenten voor WG Makelaars. Gebruik heldere alinea’s, tussenkoppen met ## en desgewenst opsommingen met -. Laat de titel weg; de app voegt die toe. Gebruik alleen aangeleverde feiten. Noteer ontbrekende essentiële gegevens als [invullen]. Geef alleen het conceptdocument, zonder codeblokken.'
        : 'Je schrijft Nederlandstalige socialmediaberichten voor WG Makelaars. Verzin geen woningdetails. Geef alleen de voorgestelde tekst.',
      input: prompt
    }),
    signal: AbortSignal.timeout(60000)
  });
  if (!response.ok) throw new Error('OpenAI-aanvraag mislukt (HTTP ' + response.status + '). Controleer je sleutel en API-toegang.');
  const result = await response.json();
  return result.output.flatMap(item => item.content || [])
    .filter(item => item.type === 'output_text').map(item => item.text).join('\n');
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

ipcMain.handle('close-window', event => {
  BrowserWindow.fromWebContents(event.sender)?.close();
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

ipcMain.handle('generate-montage', async (_, { key, prompt, showLogo, templateId }) => {
  const token = key?.trim() || process.env.OPENAI_API_KEY;
  const source = selectedVideo;
  if (!source) throw new Error('Laad eerst de video die je wilt bewerken.');
  const reference = await getVideoTemplate(videoLibraryPath(), templateId);
  if (!token) throw new Error('Vul je OpenAI API-sleutel in om de montage te maken.');
  const result = await createMontage(ffmpegBinary(), source, reference.file, prompt, token,
    showLogo ? path.join(app.isPackaged ? process.resourcesPath : __dirname, 'ui', 'icon.png') : undefined);
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

ipcMain.handle('connect-social', async (_, options) => {
  connection = await social.connect(options);
  return { facebook: connection.pageName, instagram: connection.instagram.username };
});

ipcMain.handle('publish-social', async (event, options) => {
  if (!connection) throw new Error('Koppel eerst je Facebook-pagina en Instagram-account.');
  if (publishing) throw new Error('Er wordt al een post gepubliceerd.');
  publishing = true;
  const accounts = connection;
  try {
    const { response } = await dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender), {
      type: 'question', buttons: ['Annuleren', 'Nu publiceren'], defaultId: 0, cancelId: 0,
      message: 'Deze post nu publiceren op Facebook én Instagram?',
      detail: accounts.pageName + ' · @' + accounts.instagram.username
    });
    return response === 1 ? await social.publish(accounts, options) : null;
  } finally {
    publishing = false;
  }
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
