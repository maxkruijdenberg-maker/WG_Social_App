const assert = require('node:assert/strict');
const { copyFile, mkdtemp, rm, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { createMontage, runFfmpeg } = require('../montage.cjs');

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
    let attempt = 0;
    global.fetch = async (_url, options) => {
      attempt += 1;
      const payload = JSON.parse(options.body);
      const images = payload.input[0].content.filter(item => item.type === 'input_image');
      assert.ok(images.length > 6);
      assert.ok(images.some(item => item.detail === 'high'));
      if (attempt === 1) {
        assert.equal(payload.model, 'gpt-5.4');
        assert.equal(payload.reasoning.effort, 'high');
        return Response.json({error:{code:'model_not_found'}}, {status:404});
      }
      assert.equal(payload.model, 'gpt-4.1-mini');
      assert.ok(images.every(item => item.image_url.startsWith('data:image/jpeg;base64,')));
      return Response.json({ output: [{ content: [{ type: 'output_text', text: JSON.stringify({
        segments: [], format: 'source', brightness: 0, saturation: 1, mute: true, summary: 'WG-woningtour.',
        motionEnd: 36, tempo: [{time: 4, weight: .55}, {time: 12, weight: 1.7}, {time: 24, weight: .7}]
      }) }] }] });
    };
    const result = await createMontage(binary, source, reference, 'Maak twee korte fragmenten.', 'test', logo, {
      address: 'Parklaan 24', city: 'Voorbeeldstad', contact: '0123 456 789\ncontact@example.com\nwww.example.com'
    });
    assert.equal(attempt, 2);
    assert.equal(result.bytes.subarray(4, 8).toString(), 'ftyp');
    await writeFile(path.join(directory, 'output.mp4'), result.bytes);
    const video = await runFfmpeg(binary, ['-hide_banner', '-i', 'output.mp4', '-f', 'null', '-'], directory);
    assert.equal(video.code, 0, video.stderr);
    assert.match(video.stderr, /Video: h264[^\r\n]*240x426/);
    assert.doesNotMatch(video.stderr, /Audio:/);
    assert.match(video.stderr, /Duration: 00:00:26\.[56]/);
    const frameColor = async time => {
      const frame = await runFfmpeg(binary, ['-v', 'error', '-ss', time, '-i', 'output.mp4',
        '-frames:v', '1', '-vf', 'crop=2:2:10:10,format=rgb24', '-f', 'rawvideo', 'pipe:1'], directory);
      assert.equal(frame.code, 0, frame.stderr);
      assert.equal(frame.stdout.length, 12);
      return [...frame.stdout.subarray(0, 3)];
    };
    const opening = await frameColor('0.05');
    const closing = await frameColor('25');
    assert.notDeepEqual(opening, closing);
    assert.ok(closing.every((channel, index) => Math.abs(channel - [14, 39, 59][index]) < 12), closing.join(', '));
    console.log('Rendered 26.6-second silent WG tour with speed ramp and full-screen contact card.');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

verify().catch(error => { console.error(error.message); process.exitCode = 1; });
