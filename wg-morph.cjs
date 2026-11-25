const { open } = require('node:fs/promises');
const path = require('node:path');

const BLUE = Buffer.from([14, 39, 59, 255]);
const ease = value => value * value * (3 - 2 * value);
const lerp = (a, b, t) => a + (b - a) * t;

function fillShape(frame, width, height, x, y, w, h, roof) {
  const bottom = Math.min(height, Math.round(y + h));
  for (let row = Math.max(0, Math.ceil(y)); row < bottom; row++) {
    const inset = roof && row < y + roof ? (w / 2) * (1 - (row - y) / roof) : 0;
    const left = Math.max(0, Math.ceil(x + inset));
    const right = Math.min(width, Math.floor(x + w - inset));
    if (right > left) frame.fill(BLUE, (row * width + left) * 4, (row * width + right) * 4);
  }
}

function paintLogo(frame, width, source, x, y, size) {
  if (!source) return;
  const length = Math.max(1, Math.round(size));
  for (let row = 0; row < length; row++) {
    for (let col = 0; col < length; col++) {
      const a = (Math.floor(row * 256 / length) * 256 + Math.floor(col * 256 / length)) * 4;
      const b = ((Math.floor(y) + row) * width + Math.floor(x) + col) * 4;
      if (b >= 0 && b < frame.length - 3) source.copy(frame, b, a, a + 4);
    }
  }
}

async function renderWgMorph(run, binary, directory, layout, showLogo, fps, duration) {
  const { width, height, margin, introWidth, introHeight, introLogoSize, outroLogoSize } = layout;
  const logo = showLogo ? (await run(binary, ['-v', 'error', '-i', 'logo.png', '-frames:v', '1', '-vf', 'scale=256:256',
    '-pix_fmt', 'rgba', '-f', 'rawvideo', '-threads', '1', 'pipe:1'], directory)).stdout : null;
  if (logo && logo.length !== 256 * 256 * 4) throw new Error('Het WG-logo kon niet worden gelezen.');
  const intro = await run(binary, ['-v', 'error', '-i', 'intro.png', '-frames:v', '1', '-pix_fmt', 'rgba',
    '-f', 'rawvideo', '-threads', '1', 'pipe:1'], directory);
  if (intro.stdout.length !== introWidth * introHeight * 4) throw new Error('De adresbalk kon niet worden gelezen.');
  const badgeWidth = Math.round(Math.min(width, height) * .184);
  const badgeHeight = Math.round(badgeWidth * 1.26);
  const badgeLogo = Math.round(badgeWidth * .72);
  const badgeTop = height - margin - badgeHeight;
  const badgeLogoX = margin + (badgeWidth - badgeLogo) / 2;
  const badgeLogoY = height - margin - badgeLogo - badgeWidth * .11;
  const introTop = height - margin - introHeight;
  const textStart = showLogo ? introLogoSize + 2 * margin : margin;
  const pixels = Buffer.alloc(width * height * 4);

  async function sequence(name, count, draw) {
    const file = await open(path.join(directory, name), 'w');
    try {
      for (let index = 0; index < count; index++) {
        pixels.fill(0);
        draw(ease(index / Math.max(1, count - 1)));
        await file.writeFile(pixels);
      }
    } finally { await file.close(); }
  }
  const introFrames = Math.max(2, Math.round(fps * Math.min(1.05, duration * .34)));
  const outroFrames = Math.max(2, Math.round(fps * Math.min(1.13, duration * .42)));
  await sequence('house-in.rgba', introFrames, t => {
    const w = lerp(introWidth, badgeWidth, t);
    const h = lerp(introHeight, badgeHeight, t);
    const y = height - margin - h;
    const roof = badgeHeight * .31 * ease(Math.max(0, (t - .35) / .65));
    fillShape(pixels, width, height, margin, y, w, h, roof);
    const right = Math.floor(Math.min(w, introWidth) - margin / 2);
    if (right > textStart) {
      for (let row = 0; row < introHeight; row++) {
        const outputRow = introTop + row;
        if (outputRow < y + roof || outputRow >= y + h) continue;
        intro.stdout.copy(pixels, (outputRow * width + margin + textStart) * 4,
          (row * introWidth + textStart) * 4, (row * introWidth + right) * 4);
      }
    }
    paintLogo(pixels, width, logo, lerp(2 * margin, badgeLogoX, t), lerp(introTop + (introHeight - introLogoSize) / 2, badgeLogoY, t),
      lerp(introLogoSize, badgeLogo, t));
  });
  await sequence('house-out.rgba', outroFrames, t => {
    fillShape(pixels, width, height, lerp(margin, 0, t), lerp(badgeTop, 0, t),
      lerp(badgeWidth, width, t), lerp(badgeHeight, height, t), lerp(badgeHeight * .31, 0, t));
    paintLogo(pixels, width, logo, lerp(badgeLogoX, (width - outroLogoSize) / 2, t),
      lerp(badgeLogoY, Math.floor(height * .08 / 2) * 2, t), lerp(badgeLogo, outroLogoSize, t));
  });
  return { introDuration: introFrames / fps, outroDuration: outroFrames / fps };
}

module.exports = { renderWgMorph };
