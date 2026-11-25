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
    global.fetch = async (_url, options) => {
      const payload = JSON.parse(options.body);
      const images = payload.input[0].content.filter(item => item.type === 'input_image');
      assert.equal(images.length, 6);
      assert.ok(images.every(item => item.image_url.startsWith('data:image/jpeg;base64,')));
      return Response.json({ output: [{ content: [{ type: 'output_text', text: JSON.stringify({
        segments: [{ start: 1.4, end: 2.3 }, { start: 0.1, end: 0.8 }], format: 'portrait',
        brightness: 0, saturation: 1, mute: false, summary: 'Twee fragmenten.'
      }) }] }] });
    };
    const result = await createMontage(binary, source, reference, 'Maak twee korte fragmenten.', 'test', logo);
    assert.equal(result.bytes.subarray(4, 8).toString(), 'ftyp');
    await writeFile(path.join(directory, 'output.mp4'), result.bytes);
    const video = await runFfmpeg(binary, ['-hide_banner', '-i', 'output.mp4', '-f', 'null', '-'], directory);
    assert.equal(video.code, 0, video.stderr);
    assert.match(video.stderr, /Video: h264[^\r\n]*1080x1920/);
    assert.match(video.stderr, /Audio: aac/);
    assert.match(video.stderr, /Duration: 00:00:01\.[5-8]/);
    console.log('Rendered and decoded a 9:16 MP4 with audio and WG branding from videos with Unicode names.');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

verify().catch(error => { console.error(error.message); process.exitCode = 1; });
