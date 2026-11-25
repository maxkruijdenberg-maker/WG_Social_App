const { spawnSync } = require('node:child_process');
const { mkdtempSync, mkdirSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(command + ' eindigde met status ' + result.status);
  return result.stdout;
}

const root = path.resolve(__dirname, '..');
const vendor = path.join(root, '.build', 'win');
const temporary = mkdtempSync(path.join(tmpdir(), 'wg-win-'));
try {
  mkdirSync(vendor, { recursive: true });
  const npmArgs = ['pack', '@ffmpeg-installer/win32-x64@4.1.0', '--pack-destination', temporary, '--json'];
  const packed = JSON.parse(run(process.execPath, [process.env.npm_execpath, ...npmArgs], {
    stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8'
  }))[0];
  const locked = require('../package-lock.json').packages['node_modules/@ffmpeg-installer/win32-x64'];
  if (packed.integrity !== locked.integrity) throw new Error('De checksum van FFmpeg komt niet overeen met de lockfile.');
  run('tar', ['-xf', path.join(temporary, packed.filename), '-C', vendor,
    '--strip-components=1', 'package/ffmpeg.exe', 'package/package.json']);
  run(process.execPath, [require.resolve('electron-builder/out/cli/cli'), '--win', 'zip', 'nsis', '--x64'], { cwd: root });
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
