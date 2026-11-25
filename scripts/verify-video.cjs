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
    const fixture = await runFfmpeg(binary, ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=duration=3:size=320x240:rate=25',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-c:v', 'libx264', '-c:a', 'aac', '-shortest', 'fixture.mp4'], directory);
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
        segments: [{ start: 1.4, end: 2.3 }, { start: 0.1, end: 0.8 }], format: 'portrait',
        brightness: 0, saturation: 1, mute: false, summary: 'Twee fragmenten.',
        graphics: { primary: '09243E', accent: 'AC9564', text: 'FFFFFF', direction: 'left', position: 'lower',
          introSeconds: 3.5, outroSeconds: 5.5, transition: 'normal' }
      }) }] }] });
    };
    const result = await createMontage(binary, source, reference, 'Maak twee korte fragmenten.', 'test', logo, {
      address: 'Parklaan 24', city: 'Voorbeeldstad', contact: '0123 456 789\ncontact@example.com\nwww.example.com',
      badge: path.join(path.dirname(logo), 'video-badge.png')
    });
    assert.equal(attempt, 2);
    assert.equal(result.bytes.subarray(4, 8).toString(), 'ftyp');
    await writeFile(path.join(directory, 'output.mp4'), result.bytes);
    const video = await runFfmpeg(binary, ['-hide_banner', '-i', 'output.mp4', '-f', 'null', '-'], directory);
    assert.equal(video.code, 0, video.stderr);
    assert.match(video.stderr, /Video: h264[^\r\n]*1080x1920/);
    assert.match(video.stderr, /Audio: aac/);
    assert.match(video.stderr, /Duration: 00:00:0[78]\./);
    const frameColor = async time => {
      const frame = await runFfmpeg(binary, ['-v', 'error', '-ss', time, '-i', 'output.mp4',
        '-frames:v', '1', '-vf', 'crop=2:2:10:10,format=rgb24', '-f', 'rawvideo', 'pipe:1'], directory);
      assert.equal(frame.code, 0, frame.stderr);
      assert.equal(frame.stdout.length, 12);
      return [...frame.stdout.subarray(0, 3)];
    };
    const opening = await frameColor('0.05');
    const closing = await frameColor('5');
    assert.notDeepEqual(opening, closing);
    assert.ok(closing.every((channel, index) => Math.abs(channel - [9, 36, 62][index]) < 12), closing.join(', '));
    console.log('Rendered 9:16 MP4 with audio, WG branding and a template-colored full-screen contact card.');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

verify().catch(error => { console.error(error.message); process.exitCode = 1; });
