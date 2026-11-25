const assert = require('node:assert/strict');

const endpoint = process.argv[2];
const readWindow = `(() => {
  const requireApp = process.getBuiltinModule('module').createRequire(process.resourcesPath + '/app.asar/package.json');
  const { BrowserWindow, screen } = requireApp('electron');
  const window = BrowserWindow.getAllWindows()[0];
  if (!window || !window.isVisible()) return null;
  const bounds = window.getBounds();
  return { maximized: window.isMaximized(), fullscreen: window.isFullScreen(),
    bounds, workArea: screen.getDisplayMatching(bounds).workArea };
})()`;

async function main() {
  let debuggerUrl;
  for (let attempt = 0; attempt < 30 && !debuggerUrl; attempt++) {
    try {
      const targets = await fetch(endpoint, { signal: AbortSignal.timeout(1000) }).then(response => response.json());
      debuggerUrl = targets[0]?.webSocketDebuggerUrl;
    } catch {}
    if (!debuggerUrl) await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(debuggerUrl, 'The installed app did not start');
  const socket = new WebSocket(debuggerUrl);
  try {
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    let state;
    for (let id = 1; id <= 30; id++) {
      state = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Window state check timed out')), 5000);
        socket.addEventListener('message', event => {
          clearTimeout(timer);
          const { result, error } = JSON.parse(event.data);
          if (error || result.exceptionDetails) reject(new Error(JSON.stringify(error || result.exceptionDetails)));
          else resolve(result.result.value);
        }, { once: true });
        socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: readWindow, returnByValue: true } }));
      });
      if (state?.maximized) break;
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    assert.ok(state?.maximized, 'The app should open maximized');
    assert.equal(state.fullscreen, false, 'Fullscreen would hide the Windows taskbar');
    for (const property of ['x', 'y', 'width', 'height']) {
      assert.ok(Math.abs(state.bounds[property] - state.workArea[property]) <= 24,
        'The window should fill the work area within native border tolerance: ' + JSON.stringify(state));
    }
    console.log('Windows window opens maximized within the desktop work area.');
  } finally {
    socket.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
