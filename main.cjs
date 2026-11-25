const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { readFile, writeFile } = require('node:fs/promises');
const { spawn } = require('node:child_process');
const path = require('node:path');

let selectedVideo;

function createWindow() {
  const window = new BrowserWindow({
    width: 1470, height: 980, minWidth: 1050, minHeight: 725,
    backgroundColor: '#f2f5fa', autoHideMenuBar: true,
    icon: path.join(__dirname, 'ui', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), sandbox: true }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
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
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'], filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'webm', 'm4v'] }]
  });
  if (canceled) return null;
  const bytes = await readFile(filePaths[0]);
  selectedVideo = filePaths[0];
  return bytes;
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
  const ffmpeg = app.isPackaged && process.platform === 'win32'
    ? path.join(process.resourcesPath, 'ffmpeg', 'ffmpeg.exe')
    : require('@ffmpeg-installer/ffmpeg').path;
  const args = ['-nostdin', '-y', '-ss', String(start), '-i', input, '-t', String(end - start),
    '-map', '0:v:0', '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p'];
  args.push(...(muted ? ['-an'] : ['-map', '0:a:0?', '-c:a', 'aac']));
  args.push('-movflags', '+faststart', filePath);
  await new Promise((resolve, reject) => {
    const process = spawn(ffmpeg, args, { windowsHide: true });
    let stderr = '';
    process.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-1800); });
    process.on('error', reject);
    process.on('close', code => code === 0 ? resolve() : reject(new Error(stderr)));
  });
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

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
