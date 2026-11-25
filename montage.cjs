const { spawn } = require('node:child_process');
const { copyFile, mkdtemp, readFile, writeFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { requestText } = require('./openai.cjs');

function runFfmpeg(binary, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, ['-nostdin', ...args], { windowsHide: true, cwd });
    const stdout = [];
    let stderr = '';
    child.stdout.on('data', chunk => stdout.push(chunk));
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-48000); });
    child.once('error', error => reject(new Error('FFmpeg kon niet starten (' + (error.code || 'onbekende fout') + '). Installeer WG Social Studio opnieuw.')));
    child.once('close', code => resolve({ code, stdout: Buffer.concat(stdout), stderr }));
  });
}

async function inspect(binary, input, cwd, label) {
  // FFmpeg prints stream metadata even when no output is requested.
  const { stderr } = await runFfmpeg(binary, ['-hide_banner', '-i', input], cwd);
  const match = stderr.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  const resolution = stderr.match(/Stream #[^\r\n]*Video:[^\r\n]*?\b(\d{2,5})x(\d{2,5})\b/);
  if (!match || !resolution) throw new Error(label + ' heeft geen leesbare duur of beeldstream. Probeer een MP4 met H.264.');
  const duration = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  if (duration <= 0) throw new Error(label + ' is te kort om te monteren.');
  return { duration, width: Number(resolution[1]), height: Number(resolution[2]), audio: /Stream #[^\r\n]*Audio:/.test(stderr) };
}

async function sample(binary, input, info, label, cwd) {
  const content = [{ type: 'input_text', text: label + ': ' + JSON.stringify(info) }];
  const count = Math.min(10, Math.max(3, Math.ceil(info.duration / 3)));
  for (let index = 0; index < count; index++) {
    const time = ((index + 0.35) * info.duration / count).toFixed(2);
    const frame = await runFfmpeg(binary, ['-v', 'error', '-ss', time, '-i', input, '-map', '0:v:0',
      '-frames:v', '1', '-vf', 'scale=640:640:force_original_aspect_ratio=decrease', '-q:v', '4', '-f', 'image2pipe', '-vcodec', 'mjpeg', '-threads', '1', 'pipe:1'], cwd);
    if (!frame.stdout.length) continue;
    content.push({ type: 'input_text', text: label + ' · ' + time + ' seconden' },
      { type: 'input_image', image_url: 'data:image/jpeg;base64,' + frame.stdout.toString('base64'), detail: 'low' });
  }
  if (content.length === 1) throw new Error('Er konden geen beelden uit ' + label.toLowerCase() + ' worden gelezen. Probeer een MP4 met H.264.');
  return content;
}

const schema = {
  type: 'object', additionalProperties: false,
  required: ['segments', 'format', 'brightness', 'saturation', 'mute', 'summary'],
  properties: {
    segments: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['start', 'end'],
      properties: { start: { type: 'number' }, end: { type: 'number' } } } },
    format: { type: 'string', enum: ['source', 'portrait', 'square', 'landscape'] },
    brightness: { type: 'number' }, saturation: { type: 'number' },
    mute: { type: 'boolean' }, summary: { type: 'string' }
  }
};

function validSegments(plan, info) {
  const segments = Array.isArray(plan?.segments) ? plan.segments.slice(0, 12)
    .filter(segment => Number.isFinite(segment?.start) && Number.isFinite(segment?.end))
    .map(({ start, end }) => ({ start: Math.max(0, start), end: Math.min(info.duration, end) }))
    .filter(({ start, end }) => end - start >= Math.min(.15, info.duration)) : [];
  if (!segments.length) throw new Error('De AI gaf geen geldige fragmenten terug. Probeer een concretere prompt.');
  return segments;
}

function segmentArguments(input, output, plan, segment, logo) {
  const sizes = { portrait: [1080, 1920], square: [1080, 1080], landscape: [1920, 1080] };
  const size = sizes[plan.format];
  const framing = size
    ? 'scale=' + size.join(':') + ':force_original_aspect_ratio=increase,crop=' + size.join(':')
    : 'scale=trunc(iw/2)*2:trunc(ih/2)*2';
  const brightness = Number.isFinite(plan.brightness) ? Math.max(-.12, Math.min(.12, plan.brightness)) : 0;
  const saturation = Number.isFinite(plan.saturation) ? Math.max(.6, Math.min(1.4, plan.saturation)) : 1;
  const filter = framing + ',setsar=1,fps=30,eq=brightness=' + brightness + ':saturation=' + saturation
    + ',unsharp=5:5:0.45:5:5:0';
  const args = ['-y', '-v', 'error', '-ss', String(segment.start), '-i', input];
  if (logo) {
    const logoSize = size ? Math.round(Math.min(...size) * .12) : 100;
    args.push('-i', logo, '-filter_complex_threads', '1', '-filter_complex', '[0:v:0]' + filter
      + '[base];[1:v:0]scale=' + logoSize + ':-1[logo];[base][logo]overlay=W-w-W*0.045:H*0.045[v]', '-map', '[v]');
  } else {
    args.push('-map', '0:v:0', '-vf', filter);
  }
  args.push(...(plan.mute ? ['-an'] : ['-map', '0:a:0?', '-c:a', 'aac']));
  return [...args, '-t', String(segment.end - segment.start), '-c:v', 'libx264',
    '-preset', 'fast', '-crf', '19', '-pix_fmt', 'yuv420p', output];
}

async function createMontage(binary, input, reference, prompt, token, logo) {
  const directory = await mkdtemp(path.join(tmpdir(), 'wg-montage-'));
  const sourceName = 'input' + path.extname(input).toLowerCase();
  const referenceName = 'reference' + path.extname(reference).toLowerCase();
  const logoName = logo ? 'logo.png' : undefined;
  try {
    // The bundled Windows encoder receives only simple relative filenames.
    // The working directory and original paths may contain any Unicode characters.
    await copyFile(input, path.join(directory, sourceName));
    await copyFile(reference, path.join(directory, referenceName));
    if (logoName) await copyFile(logo, path.join(directory, logoName));
    const [sourceInfo, referenceInfo] = await Promise.all([
      inspect(binary, sourceName, directory, 'De ingeladen video'),
      inspect(binary, referenceName, directory, 'Het videotemplate')
    ]);
    const [sourceFrames, referenceFrames, cuts] = await Promise.all([
      sample(binary, sourceName, sourceInfo, 'Ingeladen video', directory),
      sample(binary, referenceName, referenceInfo, 'Videotemplate', directory),
      runFfmpeg(binary, ['-hide_banner', '-t', '90', '-i', referenceName, '-an',
        '-vf', "scale=320:-2,select='gt(scene,0.28)',showinfo", '-f', 'null', '-'], directory)
    ]);
    const referenceCuts = [...cuts.stderr.matchAll(/pts_time:([\d.]+)/g)].map(match => Number(match[1]))
      .filter(time => time <= 90).slice(0, 24);
    const text = await requestText(token, {
      instructions: 'Je bent een video-editor voor WG Makelaars. Gebruik de voorbeeldframes en tijdcodes om kaders, kleur en montageritme te benaderen. Monteer uitsluitend segmenten uit de ingeladen video, nooit uit het videotemplate. Gebruik maximaal twaalf segmenten in afspeelvolgorde en binnen de duur van de ingeladen video. Je mogelijkheden zijn hard cuts, middenuitsnede, helderheid (-0.12 tot 0.12), verzadiging (0.6 tot 1.4) en het behouden of dempen van audio. Kies bij ontbreken van een opdracht de verhouding van het voorbeeld. Beschrijf in het Nederlands kort de bewerkingen die je uitvoert.',
      input: [{ role: 'user', content: [
        { type: 'input_text', text: 'Montageprompt: ' + (prompt || 'Volg de uitstraling en montage van het voorbeeld.') },
        ...referenceFrames,
        { type: 'input_text', text: 'Scèneovergangen in het videotemplate (seconden): ' + referenceCuts.join(', ') },
        ...sourceFrames
      ] }],
      text: { format: { type: 'json_schema', name: 'montage', strict: true, schema } }
    }, 120000);
    let plan;
    try { plan = JSON.parse(text); }
    catch { throw new Error('OpenAI gaf geen leesbaar montageplan terug. Probeer een kortere instructie.'); }
    const clips = [];
    for (const [index, segment] of validSegments(plan, sourceInfo).entries()) {
      const name = 'fragment-' + index + '.mp4';
      const result = await runFfmpeg(binary, segmentArguments(sourceName, name, plan, segment, logoName), directory);
      if (result.code !== 0) throw new Error('Fragment ' + (index + 1) + ' kon niet worden bewerkt. ' + result.stderr.trim().slice(-400));
      clips.push("file '" + name + "'");
    }
    await writeFile(path.join(directory, 'montage.txt'), clips.join('\n') + '\n');
    const result = await runFfmpeg(binary, ['-y', '-v', 'error', '-f', 'concat', '-safe', '1', '-i', 'montage.txt',
      '-c', 'copy', '-movflags', '+faststart', 'montage.mp4'], directory);
    if (result.code !== 0) throw new Error('De fragmenten konden niet worden samengevoegd. ' + result.stderr.trim().slice(-400));
    return { bytes: await readFile(path.join(directory, 'montage.mp4')), summary: plan.summary };
  } catch (error) {
    if (error.code === 'ENOSPC') throw new Error('Er is te weinig vrije schijfruimte voor de videomontage.');
    if (error.code === 'ENOENT') throw new Error('De ingeladen video, het videotemplate of een onderdeel van de app ontbreekt. Laad de video opnieuw.');
    throw error;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

module.exports = { createMontage, runFfmpeg };
