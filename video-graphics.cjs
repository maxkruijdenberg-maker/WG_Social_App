const { copyFile, writeFile } = require('node:fs/promises');
const path = require('node:path');

const palette = { primary: '0E273B', accent: 'AC9564', text: 'FFFFFF' };
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const even = value => Math.max(2, 2 * Math.floor(value / 2));
const seconds = value => Number(value).toFixed(3);

function safeColor(value, fallback) {
  return typeof value === 'string' && /^#?[0-9a-f]{6}$/i.test(value) ? value.replace('#', '') : fallback;
}

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

async function addVideoGraphics(run, binary, cwd, info, style, details, showLogo, showBadge) {
  await installFont(cwd);
  const { width, height, duration } = info;
  const primary = safeColor(style.primary, palette.primary);
  const accent = safeColor(style.accent, palette.accent);
  const foreground = safeColor(style.text, palette.text);
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
  const colorSettings = { background: primary, accent, foreground };

  await renderCard(run, binary, cwd, {
    label: 'intro', width: introWidth, height: introHeight, ...colorSettings,
    logo: showLogo ? { width: introLogoSize, x: margin, y: even((introHeight - introLogoSize) / 2) } : null,
    stripe: { x: introX, y: even(introHeight * .83), width: even(introWidth * .11), height: even(unit * .004) },
    lines: [
      { value: address, y: introHeight * .23, size: introHeight * .23, ...leftText },
      { value: city.toUpperCase(), y: introHeight * .52, size: introHeight * .13, ...leftText }
    ]
  });

  await renderCard(run, binary, cwd, {
    label: 'outro', width, height, ...colorSettings,
    logo: showLogo ? { width: outroLogoSize, x: '(W-w)/2', y: even(height * .08) } : null,
    stripe: { x: even(width * .40), y: even(height * .28), width: even(width * .20), height: even(unit * .005) },
    lines: [
      { value: 'Plan een bezichtiging', y: height * .34, size: unit * .052, maxWidth: width * .82 },
      { value: address, y: height * .42, size: unit * .07, maxWidth: width * .85 },
      { value: city, y: height * .50, size: unit * .043, maxWidth: width * .82 },
      ...contact.map((value, index) => ({ value, y: height * (.60 + index * .061), size: unit * .044, maxWidth: width * .84 }))
    ]
  });

  const inputs = ['-i', 'montage.mp4', '-i', 'intro.png', '-i', 'outro.png'];
  const graph = [];
  let video = '[0:v]';
  function layer(filter) {
    const output = '[g' + graph.length + ']';
    graph.push(video + filter + output);
    video = output;
  }

  const outroTime = clamp(Number(style.outroSeconds) || 5.5, 3, 9);
  const introTime = Math.min(clamp(Number(style.introSeconds) || 3.5, 1.5, 8), duration * .85);
  const travel = Math.min(.46, introTime * .29);
  const wipe = style.transition === 'fast' ? .35 : .62;
  const start = Math.max(0, duration - wipe);
  const padded = outroTime + wipe;
  layer('tpad=stop_mode=clone:stop_duration=' + seconds(padded));

  if (showBadge) {
    inputs.push('-i', 'badge.png');
    const badgeWidth = even(unit * .18);
    const output = '[badge]';
    graph.push('[3:v]scale=' + badgeWidth + ':-2' + output);
    layer(output + 'overlay=x=' + margin + ':y=H-h-' + margin);
  }

  const introRight = style.direction === 'right';
  const rest = introRight ? 'W-w-' + margin : String(margin);
  const off = introRight ? 'W' : '-w';
  const y = style.position === 'upper' ? margin : 'H-h-' + margin;
  const introMotion = 'min(1,min(t/' + seconds(travel) + ',(' + seconds(introTime) + '-t)/' + seconds(travel) + '))';
  layer('[1:v]overlay=x=\'' + off + '+((' + rest + ')-(' + off + '))*' + introMotion
    + '\':y=' + y + ':enable=\'between(t,0,' + seconds(introTime) + ')\'');

  for (let index = 0; index < 3; index++) {
    const blockWidth = index === 2 ? width - even(width / 3) * 2 : even(width / 3);
    const blockHeight = even(height * (.43 + index * .13));
    const blockStart = start + index * wipe * .16;
    const motion = 'H-h*min(1,max(0,(t-' + seconds(blockStart) + ')/' + seconds(wipe * .58) + '))';
    const label = '[wipe' + index + ']';
    graph.push('color=c=0x' + (index === 2 ? accent : primary) + ':s=' + blockWidth + 'x' + blockHeight + label);
    layer(label + 'overlay=x=' + index * even(width / 3) + ':y=\'' + motion + '\':enable=\'gte(t,' + seconds(blockStart) + ')\'');
  }
  const panelStart = start + wipe * .77;
  layer('[2:v]overlay=x=0:y=\'H*(1-min(1,max(0,(t-' + seconds(panelStart) + ')/' + seconds(wipe) + ')))\''
    + ':enable=\'gte(t,' + seconds(panelStart) + ')\'');

  const result = await run(binary, ['-y', '-v', 'error', ...inputs, '-filter_complex_threads', '1',
    '-filter_complex', graph.join(';'), '-map', video, '-map', '0:a?', ...(info.audio ? ['-af', 'apad', '-c:a', 'aac'] : []),
    '-t', seconds(duration + padded), '-c:v', 'libx264', '-preset', 'fast', '-crf', '19', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', 'montage-graphics.mp4'], cwd);
  if (result.code !== 0) throw new Error('De bewegende blokken konden niet op de video worden geplaatst. ' + result.stderr.trim().slice(-350));
  return 'montage-graphics.mp4';
}

module.exports = { addVideoGraphics };
