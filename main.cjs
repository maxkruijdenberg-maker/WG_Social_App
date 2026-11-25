const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { readFile, writeFile } = require('node:fs/promises');
const path = require('node:path');
const { createMontage, runFfmpeg } = require('./montage.cjs');
const social = require('./social.cjs');

let selectedVideo;
let referenceVideo;
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
    width: 1470, height: 980, minWidth: 880, minHeight: 640,
    backgroundColor: '#f2f5fa', autoHideMenuBar: true,
    icon: path.join(__dirname, 'ui', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), sandbox: true }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.maximize();
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
  return { bytes, name: path.basename(selectedVideo) };
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
    throw new Error('Kies een andere bestandsnaam dan de bronvideo.');
  }
  const args = ['-nostdin', '-y', '-ss', String(start), '-i', input, '-t', String(end - start),
    '-map', '0:v:0', '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p'];
  args.push(...(muted ? ['-an'] : ['-map', '0:a:0?', '-c:a', 'aac']));
  args.push('-movflags', '+faststart', filePath);
  const result = await runFfmpeg(ffmpegBinary(), args);
  if (result.code !== 0) throw new Error(result.stderr.slice(-1800));
  return true;
});

ipcMain.handle('write-text', async (_, { prompt, key }) => {
  const token = key?.trim() || process.env.OPENAI_API_KEY;
  if (!token) throw new Error('Vul je OpenAI API-sleutel in om ChatGPT te gebruiken.');
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      instructions: 'Je schrijft Nederlandstalige socialmediaberichten voor WG Makelaars. Verzin geen woningdetails. Geef alleen de voorgestelde tekst.',
      input: prompt
    }),
    signal: AbortSignal.timeout(60000)
  });
  if (!response.ok) throw new Error('OpenAI-aanvraag mislukt (HTTP ' + response.status + '). Controleer je sleutel en API-toegang.');
  const result = await response.json();
  return result.output.flatMap(item => item.content || [])
    .filter(item => item.type === 'output_text').map(item => item.text).join('\n');
});

ipcMain.handle('toggle-fullscreen', event => {
  const window = BrowserWindow.fromWebContents(event.sender);
  const fullscreen = !window.isFullScreen();
  window.setFullScreen(fullscreen);
  return fullscreen;
});

ipcMain.handle('open-video-reference', async () => {
  const { canceled, filePaths } = await pickVideo();
  if (canceled) return null;
  referenceVideo = filePaths[0];
  montage = undefined;
  return path.basename(referenceVideo);
});

ipcMain.handle('generate-montage', async (_, { key, prompt, showLogo }) => {
  const token = key?.trim() || process.env.OPENAI_API_KEY;
  if (!selectedVideo || !referenceVideo) throw new Error('Open een bronvideo en een voorbeeldvideo.');
  if (!token) throw new Error('Vul je OpenAI API-sleutel in om de montage te maken.');
  const result = await createMontage(ffmpegBinary(), selectedVideo, referenceVideo, prompt, token,
    showLogo ? path.join(app.isPackaged ? process.resourcesPath : __dirname, 'ui', 'icon.png') : undefined);
  montage = result.bytes;
  return result;
});

ipcMain.handle('save-montage', async () => {
  if (!montage) throw new Error('Maak eerst een AI-montage.');
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: 'WG-AI-montage.mp4', filters: [{ name: 'MP4-video', extensions: ['mp4'] }]
  });
  if (canceled) return false;
  if ([selectedVideo, referenceVideo].some(input => path.resolve(input).toLowerCase() === path.resolve(filePath).toLowerCase())) {
    throw new Error('Kies een andere bestandsnaam dan die van de bron- of voorbeeldvideo.');
  }
  await writeFile(filePath, montage);
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
