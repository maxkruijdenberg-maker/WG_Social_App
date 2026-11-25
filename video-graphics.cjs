const { copyFile, writeFile } = require('node:fs/promises');
const path = require('node:path');
const { renderWgMorph } = require('./wg-morph.cjs');

const even = value => Math.max(2, 2 * Math.floor(value / 2));
const seconds = value => Number(value).toFixed(3);

function clean(value, max) {
  return typeof value === 'string' ? value.trim().replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, max) : '';
}

async function installFont(directory) {
  const choices = process.platform === 'win32'
    ? ['segoeui.ttf', 'arial.ttf'].map(filename => path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', filename))
    : ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf'];
  for (const filename of choices) {
    try {
      await copyFile(filename, path.join(directory, 'wg-font.ttf'));
      return;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  throw new Error('Er is geen geschikt lettertype gevonden voor de videoanimaties.');
}

async function renderCard(run, binary, cwd, card) {
  const { width, height, background, accent, foreground, lines, label, logo, stripe } = card;
  const args = ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=0x' + background + ':s=' + width + 'x' + height];
  const filters = [stripe ? 'drawbox=x=' + stripe.x + ':y=' + stripe.y + ':w=' + stripe.width + ':h=' + stripe.height + ':color=0x' + accent + ':t=fill' : 'null'];
  for (const [index, line] of lines.entries()) {
    if (!line.value) continue;
    const textfile = label + '-' + index + '.txt';
    await writeFile(path.join(cwd, textfile), line.value, 'utf8');
    const fontSize = Math.max(8, Math.floor(Math.min(line.size, line.maxWidth / (line.value.length * .64))));
    filters.push('drawtext=fontfile=wg-font.ttf:textfile=' + textfile + ':expansion=none:fontsize=' + fontSize
      + ':fontcolor=0x' + foreground + ':x=' + (line.x ?? '(w-tw)/2') + ':y=' + Math.floor(line.y));
  }
  if (logo) {
    args.push('-i', 'logo.png', '-filter_complex_threads', '1', '-filter_complex',
      '[0:v]' + filters.join(',') + '[card];[1:v]scale=' + logo.width + ':-2[logo];[card][logo]overlay=x='
      + logo.x + ':y=' + logo.y, '-an');
  } else {
    args.push('-vf', filters.join(','));
  }
  const result = await run(binary, [...args, '-frames:v', '1', '-threads', '1', label + '.png'], cwd);
  if (result.code !== 0) throw new Error('Het titel- of contactblok kon niet worden gerenderd. ' + result.stderr.trim().slice(-350));
}

async function addVideoGraphics(run, binary, cwd, info, details, showLogo, style) {
  await installFont(cwd);
  const { width, height, duration, fps } = info;
  const { introColor, outroColor, accentColor: accent, textColor: foreground } = style;
  const address = clean(details.address, 100) || 'Woning in beeld';
  const city = clean(details.city, 65);
  const contact = typeof details.contact === 'string' ? details.contact.split(/\r?\n/)
    .map(line => clean(line, 95)).filter(Boolean).slice(0, 3) : [];
  const unit = Math.min(width, height);
  const margin = even(unit * .025);
  const introWidth = even(width * .92);
  const introHeight = even(Math.min(height * .20, unit * .30));
  const introLogoSize = even(introHeight * .77);
  const introX = showLogo ? introLogoSize + 2 * margin : margin;
  const leftText = { x: introX, maxWidth: introWidth - introX - margin };
  const outroLogoSize = even(unit * .27);
  const colorSettings = { accent, foreground };

  await renderCard(run, binary, cwd, {
    label: 'intro', width: introWidth, height: introHeight, background: introColor, ...colorSettings,
    logo: showLogo ? { width: introLogoSize, x: margin, y: even((introHeight - introLogoSize) / 2) } : null,
    stripe: { x: introX, y: even(introHeight * .83), width: even(introWidth * .11), height: even(unit * .004) },
    lines: [
      { value: address, y: introHeight * .23, size: introHeight * .23, ...leftText },
      { value: city.toUpperCase(), y: introHeight * .52, size: introHeight * .13, ...leftText }
    ]
  });

  await renderCard(run, binary, cwd, {
    label: 'outro', width, height, background: outroColor, ...colorSettings,
    logo: showLogo ? { width: outroLogoSize, x: '(W-w)/2', y: even(height * .08) } : null,
    stripe: { x: even(width * .40), y: even(height * .28), width: even(width * .20), height: even(unit * .005) },
    lines: [
      { value: 'Plan een bezichtiging', y: height * .34, size: unit * .052, maxWidth: width * .82 },
      { value: address, y: height * .42, size: unit * .07, maxWidth: width * .85 },
      { value: city, y: height * .50, size: unit * .043, maxWidth: width * .82 },
      ...contact.map((value, index) => ({ value, y: height * (.60 + index * .061), size: unit * .044, maxWidth: width * .84 }))
    ]
  });

  const layout = { width, height, margin, introWidth, introHeight, introLogoSize, outroLogoSize };
  const { introDuration, outroDuration } = await renderWgMorph(run, binary, cwd, layout, showLogo, fps, duration, style);
  const outroStart = duration - outroDuration;
  const introStart = Math.max(0, Math.min(style.introSeconds, outroStart - introDuration));
  const rawInput = filename => ['-f', 'rawvideo', '-pixel_format', 'rgba', '-video_size',
    width + 'x' + height, '-framerate', String(fps), '-i', filename];
  const padded = style.cardSeconds;
  const graph = [
    '[0:v]tpad=stop_mode=clone:stop_duration=' + seconds(padded + .08) + '[base]',
    '[base][1:v]overlay=x=' + margin + ':y=H-h-' + margin + ":enable='lt(t," + seconds(introStart) + ")'[intro]",
    '[3:v]setpts=PTS+' + seconds(introStart) + '/TB[morphin]',
    "[intro][morphin]overlay=0:0:enable='between(t," + seconds(introStart) + ',' + seconds(outroStart) + ")'[house]",
    '[4:v]setpts=PTS+' + seconds(outroStart) + '/TB[morphout]',
    "[house][morphout]overlay=0:0:enable='between(t," + seconds(outroStart) + ',' + seconds(duration) + ")'[revealed]",
    "[revealed][2:v]overlay=0:0:enable='gte(t," + seconds(duration) + ")'[video]"
  ];
  const result = await run(binary, ['-y', '-v', 'error', '-i', 'montage.mp4', '-i', 'intro.png', '-i', 'outro.png',
    ...rawInput('house-in.rgba'), ...rawInput('house-out.rgba'), '-filter_complex_threads', '1', '-filter_complex', graph.join(';'),
    '-map', '[video]', '-an', '-t', seconds(duration + padded), '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', 'montage-graphics.mp4'], cwd);
  if (result.code !== 0) throw new Error('Het uitvouwende WG-huisje kon niet op de video worden geplaatst. ' + result.stderr.trim().slice(-350));
  return 'montage-graphics.mp4';
}

module.exports = { addVideoGraphics };
