const assert = require('node:assert/strict');
const { copyFile, mkdtemp, rm, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { createMontage, runFfmpeg } = require('../montage.cjs');
const { requestWithModel } = require('../openai.cjs');

async function verify() {
  const binary = path.resolve(process.argv[2]);
  const logo = path.resolve(process.argv[3]);
  const directory = await mkdtemp(path.join(tmpdir(), 'wg-video-étage-'));
  try {
    const source = path.join(directory, 'Woning – entrée.mp4');
    const reference = path.join(directory, 'Voorbeeld – café.mp4');
    const fixture = await runFfmpeg(binary, ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=duration=36:size=240x426:rate=25',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=36', '-c:v', 'libx264', '-c:a', 'aac', '-shortest', 'fixture.mp4'], directory);
    assert.equal(fixture.code, 0, fixture.stderr);
    await copyFile(path.join(directory, 'fixture.mp4'), source);
    await copyFile(path.join(directory, 'fixture.mp4'), reference);
    global.fetch = async (_url, options) => {
      const payload = JSON.parse(options.body);
      assert.equal(payload.model, 'gpt-6.2-sol');
      assert.equal(payload.input, 'Schrijf een bijschrift.');
      return Response.json({ output: [{ content: [{ type: 'output_text', text: 'Testbijschrift' }] }] });
    };
    assert.deepEqual(await requestWithModel('test', { input: 'Schrijf een bijschrift.' }),
      { text: 'Testbijschrift', model: 'GPT‑6.2 Sol', fallback: false });
    global.fetch = async (_url, options) => {
      const payload = JSON.parse(options.body);
      assert.equal(payload.model, 'gpt-6.2-astra');
      assert.equal(payload.input, 'Schrijf een woningbrochure.');
      return Response.json({ output: [{ content: [{ type: 'output_text', text: 'Testbrochure' }] }] });
    };
    assert.deepEqual(await requestWithModel('test', { input: 'Schrijf een woningbrochure.' }, { task: 'document' }),
      { text: 'Testbrochure', model: 'GPT‑6.2 Astra', fallback: false });
    const attempts = [];
    global.fetch = async (_url, options) => {
      const payload = JSON.parse(options.body);
      attempts.push(payload.model);
      const images = payload.input[0].content.filter(item => item.type === 'input_image');
      assert.ok(images.length > 6);
      assert.ok(images.some(item => item.detail === 'high'));
      assert.equal(payload.reasoning.effort, 'high');
      if (payload.model === 'gpt-6.2-astra') {
        return Response.json({error:{code:'model_not_found'}}, {status:404});
      }
      assert.equal(payload.model, 'gpt-6.2-sol');
      assert.ok(images.every(item => item.image_url.startsWith('data:image/jpeg;base64,')));
      return Response.json({ output: [{ content: [{ type: 'output_text', text: JSON.stringify({
        segments: [], format: 'source', brightness: 0, saturation: 1, mute: true, summary: 'WG-woningtour.',
        motionEnd: 36, tempo: [{time: 4, weight: .55}, {time: 12, weight: 1.7}, {time: 24, weight: .7}]
      }) }] }] });
    };
    const details = {
      address: 'Parklaan 24', city: 'Voorbeeldstad', contact: '0123 456 789\ncontact@example.com\nwww.example.com'
    };
    const result = await createMontage(binary, source, reference, 'Maak twee korte fragmenten.', 'test', logo, details);
    assert.deepEqual(attempts, ['gpt-6.2-astra', 'gpt-6.2-sol']);
    assert.match(result.summary, /GPT‑6\.2 Sol \(terugvalmodel\)/);
    assert.equal(result.bytes.subarray(4, 8).toString(), 'ftyp');
    await writeFile(path.join(directory, 'output.mp4'), result.bytes);
    const video = await runFfmpeg(binary, ['-hide_banner', '-i', 'output.mp4', '-f', 'null', '-'], directory);
    assert.equal(video.code, 0, video.stderr);
    assert.match(video.stderr, /Video: h264[^\r\n]*240x426/);
    assert.doesNotMatch(video.stderr, /Audio:/);
    assert.match(video.stderr, /Duration: 00:00:26\.[56]/);
    const frameColor = async (time, file = 'output.mp4', x = 10, y = 10) => {
      const frame = await runFfmpeg(binary, ['-v', 'error', '-ss', time, '-i', file,
        '-frames:v', '1', '-vf', 'crop=2:2:' + x + ':' + y + ',format=rgb24', '-f', 'rawvideo', 'pipe:1'], directory);
      assert.equal(frame.code, 0, frame.stderr);
      assert.equal(frame.stdout.length, 12);
      return [...frame.stdout.subarray(0, 3)];
    };
    const opening = await frameColor('0.05');
    const closing = await frameColor('25');
    assert.notDeepEqual(opening, closing);
    assert.ok(closing.every((channel, index) => Math.abs(channel - [14, 39, 59][index]) < 12), closing.join(', '));
    const orange = await createMontage(binary, source, reference, '', 'test', logo, details,
      { plan: result.plan, feedback: 'Maak de adresbalk oranje.' });
    assert.equal(attempts.length, 2, 'Exact color command can be rendered locally');
    assert.equal(orange.plan.style.introColor, 'F28C28');
    assert.deepEqual(orange.plan.tempo, result.plan.tempo);
    await writeFile(path.join(directory, 'orange.mp4'), orange.bytes);
    const intro = await frameColor('1', 'orange.mp4', 200, 400);
    assert.ok(intro.every((channel, index) => Math.abs(channel - [242, 140, 40][index]) < 16), intro.join(', '));

    global.fetch = async (_url, options) => {
      const payload = JSON.parse(options.body);
      assert.match(payload.input[0].content[0].text, /F28C28/);
      assert.match(payload.input[0].content[0].text, /Frisgroene eindkaart/);
      return Response.json({ output: [{ content: [{ type: 'output_text', text: JSON.stringify({
        style: { outroColor: '287348' }, summary: 'Frisgroene eindkaart toegepast.'
      }) }] }] });
    };
    const green = await createMontage(binary, source, reference, '', 'test', logo, details,
      { plan: orange.plan, feedback: 'Frisgroene eindkaart graag, met de rest precies zoals die nu is.' });
    assert.equal(green.plan.style.introColor, 'F28C28');
    assert.equal(green.plan.style.outroColor, '287348');
    assert.deepEqual(green.plan.tempo, result.plan.tempo);
    await writeFile(path.join(directory, 'green.mp4'), green.bytes);
    const outro = await frameColor('25', 'green.mp4');
    assert.ok(outro.every((channel, index) => Math.abs(channel - [40, 115, 72][index]) < 16), outro.join(', '));
    assert.deepEqual(await frameColor('1', 'green.mp4', 200, 400), intro);
    console.log('Rendered 26.6-second silent WG tour with speed ramp and full-screen contact card.');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

verify().catch(error => { console.error(error.message); process.exitCode = 1; });
