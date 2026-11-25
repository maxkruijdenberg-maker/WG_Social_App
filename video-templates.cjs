const { copyFile, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const path = require('node:path');

const extensions = new Map([
  ['.mp4', 'video/mp4'], ['.m4v', 'video/mp4'], ['.mov', 'video/quicktime'], ['.webm', 'video/webm']
]);
const templateId = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;

function videoType(filename) {
  return extensions.get(path.extname(filename).toLowerCase());
}

async function addVideoTemplate(root, input, fields) {
  const extension = path.extname(input).toLowerCase();
  if (!extensions.has(extension)) throw new Error('Kies een MP4-, MOV-, WebM- of M4V-video.');
  const id = randomUUID();
  const meta = {
    id,
    name: fields.name?.trim().slice(0, 100) || path.basename(input, path.extname(input)),
    topic: fields.topic?.trim().slice(0, 75) || '',
    filename: path.basename(input)
  };
  await mkdir(root, { recursive: true });
  const staging = await mkdtemp(path.join(root, '.import-'));
  try {
    await copyFile(input, path.join(staging, 'video' + extension));
    await writeFile(path.join(staging, 'template.json'), JSON.stringify(meta), 'utf8');
    await rename(staging, path.join(root, id));
    return meta;
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

async function getVideoTemplate(root, id) {
  if (typeof id !== 'string' || !templateId.test(id)) throw new Error('Kies een opgeslagen videotemplate.');
  const directory = path.join(root, id);
  const meta = JSON.parse(await readFile(path.join(directory, 'template.json'), 'utf8'));
  const extension = path.extname(meta.filename).toLowerCase();
  if (meta.id !== id || !extensions.has(extension)) throw new Error('Dit videotemplate kan niet worden gelezen.');
  return { meta, file: path.join(directory, 'video' + extension), type: extensions.get(extension) };
}

async function listVideoTemplates(root) {
  const directories = await readdir(root, { withFileTypes: true }).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const entries = await Promise.all(directories.filter(entry => entry.isDirectory() && templateId.test(entry.name))
    .map(async entry => (await getVideoTemplate(root, entry.name)).meta));
  return entries.sort((a, b) => a.topic.localeCompare(b.topic, 'nl') || a.name.localeCompare(b.name, 'nl'));
}

module.exports = { addVideoTemplate, getVideoTemplate, listVideoTemplates, videoType };
