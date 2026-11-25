const { spawn } = require('node:child_process');
const { mkdtemp, readFile, writeFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');

function runFfmpeg(binary, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, ['-nostdin', ...args], { windowsHide: true });
    const stdout = [];
    let stderr = '';
    child.stdout.on('data', chunk => stdout.push(chunk));
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-48000); });
    child.once('error', reject);
    child.once('close', code => resolve({ code, stdout: Buffer.concat(stdout), stderr }));
  });
}

async function inspect(binary, input) {
  // FFmpeg prints stream metadata even when no output is requested.
  const { stderr } = await runFfmpeg(binary, ['-hide_banner', '-i', input]);
  const match = stderr.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  const resolution = stderr.match(/Stream #[^\r\n]*Video:[^\r\n]*?\b(\d{2,5})x(\d{2,5})\b/);
  if (!match || !resolution) throw new Error('De video heeft geen leesbare duur of beeldstream.');
  const duration = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  return { duration, width: Number(resolution[1]), height: Number(resolution[2]), audio: /Stream #[^\r\n]*Audio:/.test(stderr) };
}

async function sample(binary, input, info, label) {
  const content = [{ type: 'input_text', text: label + ': ' + JSON.stringify(info) }];
  const count = Math.min(10, Math.max(3, Math.ceil(info.duration / 3)));
  for (let index = 0; index < count; index++) {
    const time = ((index + 0.35) * info.duration / count).toFixed(2);
    const frame = await runFfmpeg(binary, ['-v', 'error', '-ss', time, '-i', input, '-map', '0:v:0',
      '-frames:v', '1', '-vf', 'scale=640:640:force_original_aspect_ratio=decrease', '-q:v', '4', '-f', 'image2pipe', '-vcodec', 'mjpeg', 'pipe:1']);
    if (!frame.stdout.length) continue;
    content.push({ type: 'input_text', text: label + ' · ' + time + ' seconden' },
      { type: 'input_image', image_url: 'data:image/jpeg;base64,' + frame.stdout.toString('base64'), detail: 'low' });
  }
  if (content.length === 1) throw new Error('Er konden geen videobeelden worden geanalyseerd.');
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
  const segments = plan.segments?.slice(0, 12).map(({ start, end }) => ({
    start: Math.max(0, start), end: Math.min(info.duration, end)
  })).filter(({ start, end }) => Number.isFinite(start) && Number.isFinite(end) && end - start >= .15);
  if (!segments?.length) throw new Error('De AI gaf geen geldige fragmenten terug. Probeer een concretere prompt.');
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
  const [sourceInfo, referenceInfo] = await Promise.all([inspect(binary, input), inspect(binary, reference)]);
  const [sourceFrames, referenceFrames, cuts] = await Promise.all([
    sample(binary, input, sourceInfo, 'Bronvideo'),
    sample(binary, reference, referenceInfo, 'Voorbeeldvideo'),
    runFfmpeg(binary, ['-hide_banner', '-i', reference, '-t', '90', '-an',
      '-vf', "scale=320:-2,select='gt(scene,0.28)',showinfo", '-f', 'null', '-'])
  ]);
  const referenceCuts = [...cuts.stderr.matchAll(/pts_time:([\d.]+)/g)].map(match => Number(match[1]))
    .filter(time => time <= 90).slice(0, 24);

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(120000),
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      instructions: 'Je bent een video-editor voor WG Makelaars. Gebruik de voorbeeldframes en tijdcodes om kaders, kleur en montageritme te benaderen. Monteer uitsluitend segmenten uit de bronvideo. Gebruik maximaal twaalf segmenten, in de gewenste afspeelvolgorde, binnen de bronduur. Houd rekening met de montageprompt. Je mogelijkheden zijn hard cuts, middenuitsnede, helderheid (-0.12 tot 0.12), verzadiging (0.6 tot 1.4) en bronaudio behouden of dempen. Als de opdracht geen gewenste verhouding geeft, kies de optie die het beste bij het voorbeeld past. Beschrijf in het Nederlands kort welke bewerkingen je werkelijk uitvoert.',
      input: [{ role: 'user', content: [{ type: 'input_text', text: 'Montageprompt: ' + (prompt || 'Volg de uitstraling en montage van het voorbeeld.') }, ...referenceFrames, { type: 'input_text', text: 'Gedetecteerde scèneovergangen in het voorbeeld (seconden): ' + referenceCuts.join(', ') }, ...sourceFrames] }],
      text: { format: { type: 'json_schema', name: 'montage', strict: true, schema } }
    })
  });
  if (!response.ok) throw new Error('OpenAI-aanvraag voor video mislukt (HTTP ' + response.status + '). Controleer de API-sleutel.');
  const body = await response.json();
  const text = body.output?.flatMap(item => item.content || []).find(item => item.type === 'output_text')?.text;
  if (!text) throw new Error('OpenAI gaf geen montageplan terug.');
  const plan = JSON.parse(text);
  const directory = await mkdtemp(path.join(tmpdir(), 'wg-montage-'));
  const output = path.join(directory, 'montage.mp4');
  try {
    const clips = [];
    const segments = validSegments(plan, sourceInfo);
    for (const [index, segment] of segments.entries()) {
      const name = 'fragment-' + index + '.mp4';
      const result = await runFfmpeg(binary, segmentArguments(input, path.join(directory, name), plan, segment, logo));
      if (result.code !== 0) throw new Error('FFmpeg kon een fragment niet bewerken. ' + result.stderr.slice(-550));
      clips.push("file '" + name + "'");
    }
    const list = path.join(directory, 'montage.txt');
    await writeFile(list, clips.join('\n'));
    const result = await runFfmpeg(binary, ['-y', '-v', 'error', '-f', 'concat', '-safe', '1', '-i', list,
      '-c', 'copy', '-movflags', '+faststart', output]);
    if (result.code !== 0) throw new Error('FFmpeg kon de fragmenten niet samenvoegen. ' + result.stderr.slice(-550));
    return { bytes: await readFile(output), summary: plan.summary };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

module.exports = { createMontage, runFfmpeg };
