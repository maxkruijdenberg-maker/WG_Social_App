const $ = id => document.getElementById(id);
const fields = ['format', 'position', 'brightness', 'headline', 'subtitle', 'show-logo'];
const defaults = [
  { id: 'sale', topic: 'Nieuw in verkoop', name: 'WG · Nieuw in verkoop', headline: 'Nu te koop', color: '#19375e' },
  { id: 'sold', topic: 'Verkocht', name: 'WG · Verkocht', headline: 'Verkocht', color: '#14635b' },
  { id: 'open', topic: 'Open huis', name: 'WG · Open huis', headline: 'Open huis', color: '#195d9f' }
];
const icons = {
  check: '<path d="m5 12 4 4L19 6"/>',
  layout: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  sparkles: '<path d="M12 3c0 6-3 9-9 9 6 0 9 3 9 9 0-6 3-9 9-9-6 0-9-3-9-9ZM19 3v4m-2-2h4"/>',
  video: '<rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m3 19 5-5 3 3 5-6 5 6"/>',
  settings: '<path d="M4 7h16M4 17h16M9 4v6m6 4v6"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/>'
};
document.querySelectorAll('[data-icon]').forEach(node => {
  node.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + icons[node.dataset.icon] + '</svg>';
});
function readLocal(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
const examples = readLocal('wg-copy-examples', {});
const templates = [...defaults];
const db = new Promise((resolve, reject) => {
  const request = indexedDB.open('wg-studio', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('templates', { keyPath: 'id' });
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
async function libraryRequest(mode, action) {
  const database = await db;
  return new Promise((resolve, reject) => {
    const tx = database.transaction('templates', mode);
    const request = action(tx.objectStore('templates'));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
let statusTimer;
function status(message) {
  $('status').textContent = message;
  $('status').hidden = false;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { $('status').hidden = true; }, 5200);
}
function showTab(id) {
  const button = document.querySelector('[data-tab="' + id + '"]');
  document.querySelectorAll('.screen').forEach(screen => { screen.hidden = screen.id !== id; });
  document.querySelectorAll('[data-tab]').forEach(item => item.removeAttribute('aria-current'));
  button.setAttribute('aria-current', 'page');
  $('title').textContent = button.textContent.trim();
  $('export-image').hidden = id !== 'design';
  if (id === 'templates') renderTemplateLibrary();
}
document.querySelectorAll('[data-tab]').forEach(button => button.onclick = () => showTab(button.dataset.tab));

function setOptions(select, options) {
  select.replaceChildren(...options.map(([value, label]) => new Option(label, value)));
}
let activeTemplate = defaults[0];
let overlay;
let photo;
let selection = 0;
const logo = new Image();
logo.onload = () => render();
logo.src = 'logo.svg';
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Deze afbeelding kan niet worden gelezen.'));
    image.src = url;
  });
}
async function imageFromFile(file) {
  const url = URL.createObjectURL(file);
  try { return await loadImage(url); }
  finally { URL.revokeObjectURL(url); }
}
function cover(ctx, image, x, y, w, h, position) {
  const scale = Math.max(w / image.width, h / image.height);
  const sourceW = w / scale;
  const sourceH = h / scale;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, (image.width - sourceW) * position, (image.height - sourceH) * position,
    sourceW, sourceH, x, y, w, h);
}
function drawPostLogo(ctx, w, base, margin) {
  if ($('show-logo').checked && logo.complete && logo.naturalWidth) {
    const size = Math.round(base * .105);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.roundRect(w - margin - size, margin, size, size * 1.12, size * .09);
    ctx.fill();
    ctx.drawImage(logo, w - margin - size * .91, margin + size * .07, size * .82, size * .98);
  }
}
function render() {
  const canvas = $('post');
  const [w, h] = ($('format').value || '1080x1080').split('x').map(Number);
  canvas.width = w;
  canvas.height = h;
  $('dimensions').textContent = w + ' × ' + h + ' px';
  const ctx = canvas.getContext('2d');
  const color = activeTemplate.color;
  const position = Number($('position').value);
  const band = h * .25;
  const base = Math.min(w, h);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  if (photo) {
    ctx.filter = 'brightness(' + $('brightness').value + '%)';
    cover(ctx, photo, 0, 0, w, overlay ? h : h - band, position);
    ctx.filter = 'none';
  }
  if (overlay) {
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(overlay, 0, 0, w, h);
    drawPostLogo(ctx, w, base, base * .06);
    refreshArtboard();
    return;
  }
  ctx.fillStyle = '#f29b42';
  ctx.fillRect(0, h - band, w, base * .009);
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  const margin = base * .06;
  ctx.font = '700 ' + Math.round(base * .020) + 'px Segoe UI, sans-serif';
  ctx.fillText('W G   M A K E L A A R S', margin, h - band * .79, w - margin * 2);
  ctx.font = '750 ' + Math.round(base * .073) + 'px Segoe UI, sans-serif';
  ctx.fillText($('headline').value, margin, h - band * .49, w - margin * 2.5);
  ctx.font = '400 ' + Math.round(base * .032) + 'px Segoe UI, sans-serif';
  ctx.fillText($('subtitle').value, margin, h - band * .20, w - margin * 2.5);
  drawPostLogo(ctx, w, base, margin);
  refreshArtboard();
}
function refreshArtboard() {
  resizeArtboard();
}
async function chooseTemplate(template) {
  const version = ++selection;
  activeTemplate = template;
  overlay = undefined;
  $('headline').value = template.headline;
  ['headline', 'subtitle'].forEach(id => { $(id).disabled = template.mode === 'overlay'; });
  const customFormat = $('format').querySelector('[data-custom]');
  if (customFormat) customFormat.remove();
  if (template.ratio) {
    const formats = [...$('format').options];
    const ratio = option => option.value.split('x').map(Number).reduce((w, h) => w / h);
    formats.sort((a, b) => Math.abs(Math.log(ratio(a) / template.ratio))
      - Math.abs(Math.log(ratio(b) / template.ratio)));
    $('format').value = formats[0].value;
    if (template.mode === 'overlay' && Math.abs(ratio(formats[0]) - template.ratio) > .015) {
      const scale = Math.min(1, 4096 / Math.max(template.width || 1080, template.height || 1080));
      const w = Math.round((template.width || 1080) * scale);
      const h = Math.round((template.height || (1080 / template.ratio)) * scale);
      const option = new Option('Origineel Canva-formaat', w + 'x' + h);
      option.dataset.custom = 'true';
      $('format').add(option);
      $('format').value = option.value;
    }
  }
  if (template.mode === 'overlay') {
    try {
      const image = await imageFromFile(template.file);
      if (version !== selection) return;
      overlay = image;
    } catch (error) { status(error.message); }
  }
  render();
}
function refreshTemplateOptions(topic, id) {
  const matching = templates.filter(template => template.topic === topic);
  setOptions($('template'), matching.map(template => [template.id, template.name]));
  $('template').value = id ?? matching[0].id;
  chooseTemplate(matching.find(template => template.id === $('template').value));
}
function refreshLibrary(topic = activeTemplate.topic, id = activeTemplate.id) {
  const topics = [...new Set(templates.map(template => template.topic))];
  setOptions($('topic'), topics.map(name => [name, name]));
  $('topic').value = topic;
  const copyTopic = $('copy-topic').value;
  const copyTopics = [...new Set([...topics, 'Overig'])];
  setOptions($('copy-topic'), copyTopics.map(name => [name, name]));
  $('copy-topic').value = copyTopics.includes(copyTopic) ? copyTopic : topic;
  refreshCopyTopic();
  $('topics').replaceChildren(...topics.map(name => new Option(name)));
  renderTemplateLibrary();
  refreshTemplateOptions(topic, id);
}
$('topic').onchange = () => refreshTemplateOptions($('topic').value);
$('template').onchange = () => chooseTemplate(templates.find(({ id }) => id === $('template').value));
fields.forEach(id => { $(id).oninput = render; });
$('photo').onchange = async () => {
  const file = $('photo').files[0];
  if (!file) return;
  try {
    photo = await imageFromFile(file);
    $('photo-name').textContent = file.name;
    render();
  } catch (error) { status(error.message); }
};
$('export-image').onclick = async () => {
  try {
    const blob = await new Promise(resolve => $('post').toBlob(resolve, 'image/png'));
    if (window.desktop) {
      if (await window.desktop.saveImage(new Uint8Array(await blob.arrayBuffer()))) status('PNG opgeslagen.');
    } else {
      const link = document.createElement('a');
      link.download = 'WG-social-post.png';
      link.href = URL.createObjectURL(blob);
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }
  } catch (error) { status(error.message); }
};

function referenceColor(image) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, 32, 32);
  const { data } = ctx.getImageData(0, 23, 32, 9);
  let r = 0, g = 0, b = 0, count = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 100) continue;
    r += data[i]; g += data[i + 1]; b += data[i + 2]; count++;
  }
  if (!count) return '#19375e';
  return 'rgb(' + [r, g, b].map(channel => Math.round(channel / count * .45)).join(',') + ')';
}
$('add-template').onclick = async () => {
  const category = libraryCategory;
  const topic = $('template-topic').value.trim() || categoryTopics[category];
  const name = $('template-name').value.trim();
  const file = $('template-file').files[0];
  if (!topic || !name || !file) return status('Vul onderwerp en naam in en kies een afbeelding.');
  try {
    const image = await imageFromFile(file);
    const mode = $('template-mode').value;
    if (mode === 'overlay' && file.type !== 'image/png') return status('Gebruik een transparante PNG voor een overlay.');
    const template = { id: crypto.randomUUID(), name, topic, category, file, mode, headline: topic, color: referenceColor(image), ratio: image.width / image.height, width: image.width, height: image.height };
    await libraryRequest('readwrite', store => store.add(template));
    templates.push(template);
    refreshLibrary(topic, template.id);
    ['template-topic', 'template-name', 'template-file'].forEach(id => { $(id).value = ''; });
    status('Template opgeslagen bij ' + topic + '.');
  } catch (error) { status(error.message); }
};

$('copy-topic').onchange = refreshCopyTopic;
$('save-example').onclick = () => {
  examples[$('copy-topic').value] = $('example-copy').value;
  localStorage.setItem('wg-copy-examples', JSON.stringify(examples));
  status('Voorbeeldtekst opgeslagen.');
};
$('generate-text').onclick = async () => {
  const prompt = $('prompt').value.trim();
  if (!prompt) return status('Beschrijf welke tekst je wilt schrijven.');
  if (!window.desktop) return status('Open de desktopapp om ChatGPT te gebruiken.');
  $('generate-text').disabled = true;
  const mode = writingMode;
  const isDocument = mode === 'document';
  try {
    const example = $('example-copy').value.trim();
    const request = isDocument
      ? ['Opdracht: ' + prompt, 'Documenttitel: ' + $('document-title').value.trim(),
        'Aangeleverde gegevens en notities: ' + ($('document-details').value.trim() || 'Geen aanvullende gegevens.')].join('\n\n')
      : ['Onderwerp: ' + $('copy-topic').value, 'Opdracht: ' + prompt,
        example && 'Gebruik dit voorbeeld alleen als stijlgids:\n' + example].filter(Boolean).join('\n\n');
    const result = await window.desktop.writeText({ prompt: request, mode });
    writingDrafts[mode].output = result.text;
    writingDrafts[mode].model = 'Gemaakt met ' + result.model + (result.fallback ? ' (terugvalmodel).' : '.');
    if (writingMode === mode) {
      $('copy-output').value = result.text;
      renderWritingModel();
    }
  } catch (error) { status(desktopError(error)); }
  finally { $('generate-text').disabled = false; }
};
$('copy-text').onclick = async () => {
  if (!$('copy-output').value) return status('Er is nog geen concepttekst om te kopiëren.');
  try { await navigator.clipboard.writeText($('copy-output').value); status('Tekst gekopieerd.'); }
  catch { status('Kopiëren is niet gelukt. Selecteer de tekst en gebruik Ctrl+C.'); }
};

let videoUrl;
let clipEnd;
let openingSource = false;
let exportingVideo = false;
const player = $('player');
$('open-video').onclick = async () => {
  if (!window.desktop) return status('Open de desktopapp om een video te bewerken.');
  openingSource = true;
  updateMontageAction();
  try {
    const file = await window.desktop.openVideo();
    if (!file) return;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    clipEnd = undefined;
    $('export-video').disabled = $('play-clip').disabled = true;
    resetMontage();
    $('source-name').textContent = file.name;
    videoUrl = URL.createObjectURL(new Blob([file.bytes], { type: file.type }));
    updateMontageAction();
    player.src = videoUrl;
    $('view-source').hidden = false;
  } catch (error) { status(error.message); }
  finally { openingSource = false; updateMontageAction(); }
};
player.onloadedmetadata = () => {
  if (visibleVideo === 'source') showVideo('source');
  $('video-start').value = 0;
  $('video-end').value = player.duration;
  $('export-video').disabled = $('play-clip').disabled = !Number.isFinite(player.duration);
};
player.onerror = () => {
  if (visibleVideo === 'source') showVideo('source');
  status('Dit videobestand kan niet worden afgespeeld. Probeer een MP4 met H.264.');
};
function clipRange() {
  const start = $('video-start').valueAsNumber;
  const end = $('video-end').valueAsNumber;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > player.duration) {
    status('Kies een begin en einde binnen de duur van de video.');
    return null;
  }
  return { start, end };
}
$('play-clip').onclick = async () => {
  const range = clipRange();
  if (!range) return;
  showVideo('source');
  clipEnd = range.end;
  player.currentTime = range.start;
  try { await player.play(); } catch (error) { status(error.message); }
};
player.ontimeupdate = () => {
  if (clipEnd !== undefined && player.currentTime >= clipEnd) {
    player.pause();
    clipEnd = undefined;
  }
};
$('mute-video').onchange = () => { player.muted = $('mute-video').checked; };
$('export-video').onclick = async () => {
  const range = clipRange();
  if (!range) return;
  exportingVideo = true;
  $('export-video').disabled = true;
  updateMontageAction();
  status('Video exporteren…');
  try {
    if (await window.desktop.exportVideo({ ...range, muted: $('mute-video').checked })) {
      status('MP4 opgeslagen.');
    }
  } catch (error) { status(error.message); }
  finally { exportingVideo = false; $('export-video').disabled = false; updateMontageAction(); }
};

const artboard = document.querySelector('.artboard');
const canvas = $('post');
const canvasWrap = document.createElement('div');
canvasWrap.className = 'canvas-wrap';
artboard.insertBefore(canvasWrap, canvas);
canvasWrap.append(canvas);
function resizeArtboard() {
  const style = getComputedStyle(artboard);
  const width = artboard.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const height = artboard.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  const scale = Math.min(width / canvas.width, height / canvas.height);
  if (scale > 0) {
    canvasWrap.style.width = Math.floor(canvas.width * scale) + 'px';
    canvasWrap.style.height = Math.floor(canvas.height * scale) + 'px';
  }
}
new ResizeObserver(resizeArtboard).observe(artboard);
$('show-grid').onchange = () => canvasWrap.classList.toggle('grid-visible', $('show-grid').checked);

let videoTemplates = [];
let referenceUrl;
let referenceId;
let montageUrl;
let visibleVideo = 'source';
let makingMontage = false;
let savingMontage = false;
let importingTemplate = false;
const referencePlayer = $('reference-player');
const montagePlayer = $('montage-player');
let activeVideoTemplate;
montagePlayer.onloadedmetadata = () => { montagePlayer.currentTime = Math.min(.08, montagePlayer.duration / 2); };

function showVideo(which) {
  visibleVideo = which;
  const visible = {
    source: which === 'source' && Boolean(videoUrl) && player.readyState >= 1 && !player.error,
    reference: which === 'reference' && Boolean(referenceUrl),
    montage: which === 'montage' && Boolean(montageUrl)
  };
  for (const [name, video] of [['source', player], ['reference', referencePlayer], ['montage', montagePlayer]]) {
    video.hidden = !visible[name];
    if (video.hidden) video.pause();
  }
  $('video-empty').hidden = Object.values(visible).some(Boolean);
  $('view-source').setAttribute('aria-pressed', String(visible.source));
  $('preview-template').setAttribute('aria-pressed', String(visible.reference));
  $('view-montage').setAttribute('aria-pressed', String(visible.montage));
}

function resetMontage(clearFeedback = true) {
  if (montageUrl) {
    montagePlayer.pause();
    montagePlayer.removeAttribute('src');
    montagePlayer.load();
    URL.revokeObjectURL(montageUrl);
  }
  montageUrl = undefined;
  if (clearFeedback) {
    $('montage-feedback').hidden = true;
    $('montage-feedback-input').value = '';
    $('montage-feedback-log').replaceChildren();
    $('montage-feedback-log').hidden = true;
  }
  $('view-montage').hidden = $('montage-summary').hidden = true;
  $('montage-status').textContent = 'De download wordt beschikbaar zodra je montage klaar is.';
  $('view-source').hidden = !videoUrl;
  showVideo('source');
}

function updateMontageAction() {
  const active = makingMontage || savingMontage || openingSource || exportingVideo || importingTemplate;
  $('open-video').disabled = active;
  $('open-reference').disabled = active;
  $('preview-template').hidden = !activeVideoTemplate;
  $('preview-template').disabled = active;
  $('generate-montage').disabled = active || !videoUrl || !activeVideoTemplate;
  $('save-montage').disabled = active || !montageUrl;
  $('montage-feedback-input').disabled = $('revise-montage').disabled = active || !montageUrl;
}

function chooseVideoTemplate(template) {
  if (activeVideoTemplate?.id === template.id) return;
  activeVideoTemplate = template;
  $('active-video-template').textContent = [template.topic, template.name].filter(Boolean).join(' · ');
  if (referenceUrl) {
    referencePlayer.pause();
    referencePlayer.removeAttribute('src');
    referencePlayer.load();
    URL.revokeObjectURL(referenceUrl);
    referenceUrl = undefined;
  }
  referenceId = undefined;
  resetMontage();
  updateMontageAction();
}

$('view-source').onclick = () => showVideo('source');
$('view-montage').onclick = () => showVideo('montage');
referencePlayer.onerror = () => {
  if (referenceUrl && visibleVideo === 'reference') {
    showVideo('source');
    status('Deze voorbeeldvideo kan niet worden afgespeeld. Probeer een MP4 met H.264.');
  }
};
$('preview-template').onclick = async () => {
  const id = activeVideoTemplate?.id;
  if (!id) return;
  if (referenceId === id && referenceUrl) return showVideo('reference');
  try {
    const file = await window.desktop.previewVideoTemplate(id);
    if (activeVideoTemplate?.id !== id || referenceId === id) return;
    referenceUrl = URL.createObjectURL(new Blob([file.bytes], { type: file.type }));
    referenceId = id;
    referencePlayer.src = referenceUrl;
    showVideo('reference');
  } catch (error) { status(error.message); }
};
$('open-reference').onclick = async () => {
  if (!window.desktop) return status('Open de desktopapp om een videotemplate toe te voegen.');
  importingTemplate = true;
  updateMontageAction();
  try {
    const template = await window.desktop.importVideoTemplate({
      name: $('video-template-name').value,
      topic: $('video-template-topic').value
    });
    if (!template) return;
    videoTemplates.push(template);
    $('video-template-name').value = '';
    $('video-template-topic').value = '';
    status('Videotemplate bewaard.');
  } catch (error) { status(error.message); }
  finally { importingTemplate = false; updateMontageAction(); renderTemplateLibrary(); }
};
if (window.desktop?.listVideoTemplates) {
  window.desktop.listVideoTemplates().then(items => {
    const known = new Set(videoTemplates.map(item => item.id));
    videoTemplates.push(...items.filter(item => !known.has(item.id)));
    renderTemplateLibrary();
  }).catch(error => status(error.message));
}

$('video-cards').onchange = () => { $('video-card-details').hidden = !$('video-cards').checked; };
$('video-contact').value = localStorage.getItem('wg-video-contact') || '';
$('video-contact').onchange = () => {
  try { localStorage.setItem('wg-video-contact', $('video-contact').value); }
  catch (error) { status(error.message); }
};

function showMontageResult(result, clearFeedback) {
  resetMontage(clearFeedback);
  montageUrl = URL.createObjectURL(new Blob([result.bytes], { type: 'video/mp4' }));
  montagePlayer.src = montageUrl;
  $('montage-summary').textContent = result.summary;
  ['view-source', 'view-montage', 'montage-summary', 'montage-feedback'].forEach(id => { $(id).hidden = false; });
  $('montage-status').textContent = 'Montage klaar. Download de MP4 of typ hieronder wat je wilt aanpassen.';
  showVideo('montage');
}

$('generate-montage').onclick = async () => {
  makingMontage = true;
  updateMontageAction();
  const feedback = $('montage-status');
  feedback.textContent = 'Beelden analyseren en de montage maken…';
  try {
    const result = await window.desktop.generateMontage({
      prompt: $('video-prompt').value.trim(),
      showLogo: $('video-logo').checked,
      templateId: activeVideoTemplate.id,
      animateCards: $('video-cards').checked,
      address: $('video-address').value,
      city: $('video-city').value,
      contact: $('video-contact').value
    });
    showMontageResult(result, true);
  } catch (error) { feedback.textContent = desktopError(error); }
  finally {
    makingMontage = false;
    updateMontageAction();
  }
};
$('montage-feedback-form').onsubmit = async event => {
  event.preventDefault();
  const input = $('montage-feedback-input');
  const text = input.value.trim();
  if (input.disabled || !text) return;
  makingMontage = true;
  updateMontageAction();
  const status = $('montage-status');
  status.textContent = 'Je wijziging wordt verwerkt…';
  try {
    const result = await window.desktop.reviseMontage(text);
    showMontageResult(result, false);
    const item = document.createElement('li');
    const instruction = document.createElement('strong');
    instruction.textContent = text;
    const description = document.createElement('span');
    description.textContent = result.summary;
    item.append(instruction, description);
    const log = $('montage-feedback-log');
    log.append(item);
    log.hidden = false;
    log.scrollTop = log.scrollHeight;
    input.value = '';
  } catch (error) {
    status.textContent = desktopError(error);
  } finally {
    makingMontage = false;
    updateMontageAction();
    input.focus();
  }
};

$('save-montage').onclick = async () => {
  savingMontage = true;
  updateMontageAction();
  try {
    if (await window.desktop.saveMontage()) $('montage-status').textContent = 'MP4 opgeslagen.';
  } catch (error) { $('montage-status').textContent = desktopError(error); }
  finally { savingMontage = false; updateMontageAction(); }
};

function desktopError(error) {
  return error.message.replace(/^Error invoking remote method '[^']+': Error: /, '');
}

const apiKeyStatus = $('api-key-status');
const keyForm = $('api-key-form');
const keyField = $('api-key');
const saveKeyButton = $('save-api-key');
const clearKeyButton = $('clear-api-key');
let keyState;
let keyBusy = false;

function updateKeyControls() {
  const saved = keyState === 'saved';
  keyField.disabled = saved || keyBusy || !keyState;
  saveKeyButton.hidden = !keyState || saved;
  saveKeyButton.disabled = keyField.disabled;
  clearKeyButton.disabled = keyBusy;
}

function showKeyStatus(value) {
  keyState = value;
  const saved = value === 'saved';
  if (saved) keyField.value = '';
  keyField.placeholder = saved ? 'API-sleutel opgeslagen' : 'Plak je OpenAI API-sleutel';
  $('api-key-field').classList.toggle('is-saved', saved);
  $('api-key-check').hidden = !saved;
  clearKeyButton.hidden = value !== 'saved' && value !== 'unreadable';
  const messages = {
    missing: 'Er is nog geen API-sleutel opgeslagen.',
    saved: 'Je sleutel is versleuteld opgeslagen. Verwijder de opgeslagen sleutel als je een andere wilt invoeren.',
    environment: 'De app gebruikt een API-sleutel uit de omgevingsinstellingen.'
  };
  apiKeyStatus.textContent = messages[value] || 'Sla je API-sleutel opnieuw op of verwijder de oude sleutel.';
  document.querySelectorAll('.ai-key-link').forEach(link => { link.hidden = saved || value === 'environment'; });
  updateKeyControls();
}

document.querySelectorAll('[data-open-settings]').forEach(button => {
  button.onclick = () => { showTab('settings'); keyField.focus(); };
});
keyForm.onsubmit = async event => {
  event.preventDefault();
  if (keyField.disabled) return;
  if (!window.desktop?.saveApiKey) return status('Open de desktopapp om een sleutel op te slaan.');
  const key = keyField.value;
  keyBusy = true;
  updateKeyControls();
  try { showKeyStatus(await window.desktop.saveApiKey(key)); }
  catch (error) { apiKeyStatus.textContent = desktopError(error); }
  finally { keyBusy = false; updateKeyControls(); }
};
clearKeyButton.onclick = async () => {
  if (keyBusy) return;
  keyBusy = true;
  let cleared = false;
  updateKeyControls();
  try {
    keyField.value = '';
    showKeyStatus(await window.desktop.clearApiKey());
    cleared = true;
  } catch (error) { apiKeyStatus.textContent = desktopError(error); }
  finally {
    keyBusy = false;
    updateKeyControls();
    if (cleared) keyField.focus();
  }
};
if (window.desktop?.apiKeyStatus) {
  window.desktop.apiKeyStatus().then(showKeyStatus).catch(error => {
    showKeyStatus('unreadable');
    apiKeyStatus.textContent = desktopError(error);
  });
} else {
  showKeyStatus('missing');
}

const categoryTopics = { sale: 'Nieuw in verkoop', sold: 'Verkocht', open: 'Open huis', other: '' };
const categoryNames = { sale: 'Verkoop', sold: 'Verkocht', open: 'Open huis', video: 'Video', documents: 'AI-documenten', other: 'Overig' };
const builtInPrompts = [
  { id: 'brochure', name: 'Woningbrochure', description: 'Beschrijving, kenmerken, indeling en omgeving.',
    prompt: 'Maak een professionele woningbrochure voor WG Makelaars. Gebruik een korte introductie, woningkenmerken, indeling per verdieping, buitenruimte, ligging en een afsluiting over bezichtigen. Gebruik alleen de aangeleverde informatie en noem ontbrekende gegevens als invulpunten.' },
  { id: 'proposal', name: 'Verkoopvoorstel', description: 'Een voorstel met verkoopaanpak, planning en afspraken.',
    prompt: 'Schrijf een verkoopvoorstel namens WG Makelaars aan de eigenaar. Neem de woning, voorgestelde verkoopaanpak, marketing, bezichtigingen, planning en vervolgstappen op. Neem bedragen en afspraken alleen op als ze zijn aangeleverd. Gebruik invulpunten voor ontbrekende gegevens.' },
  { id: 'viewing', name: 'Bezichtigingsverslag', description: 'Leg feedback, vragen en vervolgacties vast.',
    prompt: 'Maak een beknopt bezichtigingsverslag voor intern gebruik bij WG Makelaars. Gebruik de woning, datum, aanwezigen, algemene indruk, vragen, aandachtspunten en afgesproken acties. Scheid feitelijke observaties van reacties en verzin geen details.' },
  { id: 'open-house', name: 'Openhuisdraaiboek', description: 'Voorbereiding, taakverdeling en opvolging.',
    prompt: 'Maak een praktisch draaiboek voor een open huis voor WG Makelaars. Werk voorbereiding, materialen, ontvangst, rondleiding, contactregistratie en opvolging uit. Gebruik de aangeleverde datum, locatie en taakverdeling. Markeer ontbrekende gegevens als invulpunten.' }
];
const documentPrompts = readLocal('wg-document-prompts', []);
let captionPrompts = readLocal('wg-caption-prompts', []);
const writingDrafts = { caption: { prompt: '', output: '', model: '' }, document: { prompt: '', output: '', model: '' } };
let writingMode = 'caption';
let libraryCategory = 'sale';
let editingPromptId;
const categoryButtons = document.querySelectorAll('[data-category]');
const modeButtons = document.querySelectorAll('[data-writing-mode]');

function categoryFor(template) {
  if (Object.hasOwn(categoryTopics, template.category)) return template.category;
  if (['sale', 'sold', 'open'].includes(template.id)) return template.id;
  const topic = template.topic.toLowerCase().replace(/[^a-z]/g, '');
  if (topic.includes('openhuis')) return 'open';
  if (topic.includes('verkocht')) return 'sold';
  return /verkoop|tekoop/.test(topic) ? 'sale' : 'other';
}

function selectLibraryCategory(category) {
  if (libraryCategory !== category) {
    libraryCategory = category;
    editLibraryPrompt();
  }
  renderTemplateLibrary();
}

function openLibrary(category) {
  selectLibraryCategory(category);
  showTab('templates');
}

function openImageTemplate(template) {
  $('topic').value = template.topic;
  refreshTemplateOptions(template.topic, template.id);
  showTab('design');
}

function libraryItem({ icon, name, description, use, edit, move }) {
  const entry = document.createElement('div');
  entry.className = 'library-item';
  const symbol = document.createElement('i');
  symbol.className = 'type-icon';
  symbol.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + icons[icon] + '</svg>';
  const label = document.createElement('div');
  const title = document.createElement('strong');
  const detail = document.createElement('small');
  title.textContent = name;
  detail.textContent = description;
  label.append(title, detail);
  const actions = document.createElement('div');
  actions.className = 'actions';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'secondary';
  button.textContent = 'Gebruiken';
  button.setAttribute('aria-label', name + ' gebruiken');
  button.onclick = use;
  actions.append(button);
  if (edit) {
    const update = document.createElement('button');
    update.type = 'button';
    update.className = 'secondary';
    update.textContent = 'Wijzig';
    update.setAttribute('aria-label', name + ' wijzigen');
    update.onclick = edit;
    actions.append(update);
  }
  if (move) {
    const select = document.createElement('select');
    select.setAttribute('aria-label', name + ' verplaatsen');
    setOptions(select, [['', 'Verplaatsen'], ...Object.keys(categoryTopics)
      .filter(category => category !== libraryCategory).map(category => [category, categoryNames[category]])]);
    select.onchange = async () => {
      const destination = select.value;
      if (!destination) return;
      select.disabled = true;
      await move(destination);
    };
    actions.append(select);
  }
  entry.append(symbol, label, actions);
  return entry;
}

function renderTemplateLibrary() {
  categoryButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === libraryCategory)));
  $('library-heading').textContent = categoryNames[libraryCategory];
  $('image-template-form').hidden = !Object.hasOwn(categoryTopics, libraryCategory);
  $('video-library-form').hidden = libraryCategory !== 'video';
  const isDocument = libraryCategory === 'documents';
  $('prompt-library-form').hidden = libraryCategory === 'video';
  $('caption-prompt-category-label').hidden = isDocument;
  const rows = [];
  if (libraryCategory === 'video') {
    for (const item of videoTemplates) {
      rows.push(libraryItem({ icon: 'video', name: item.name, description: item.topic || 'Voorbeeldvideo', use: () => {
        if (makingMontage || savingMontage || importingTemplate) return status('Wacht tot de huidige videobewerking is voltooid.');
        chooseVideoTemplate(item);
        showTab('video');
      } }));
    }
  } else if (libraryCategory === 'documents') {
    for (const item of [...builtInPrompts, ...documentPrompts]) {
      rows.push(libraryItem({ icon: 'sparkles', name: item.name, description: item.description || 'Eigen documentprompt',
        use: () => useDocumentPrompt(item), edit: item.description ? null : () => editLibraryPrompt(item) }));
    }
  } else {
    for (const item of captionPrompts.filter(item => item.category === libraryCategory)) {
      rows.push(libraryItem({ icon: 'sparkles', name: item.name, description: 'Prompt voor bijschrift',
        use: () => useCaptionPrompt(item), edit: () => editLibraryPrompt(item) }));
    }
    for (const item of templates.filter(item => categoryFor(item) === libraryCategory)) {
      rows.push(libraryItem({ icon: 'image', name: item.name, description: item.topic,
        use: () => openImageTemplate(item), move: item.file ? async destination => {
          try {
            const next = { ...item, category: destination };
            await libraryRequest('readwrite', store => store.put(next));
            item.category = destination;
            renderTemplateLibrary();
            status('Template verplaatst naar ' + categoryNames[destination] + '.');
          } catch (error) {
            renderTemplateLibrary();
            status(error.message);
          }
        } : null }));
    }
  }
  if (rows.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = libraryCategory === 'video' ? 'Voeg een voorbeeldvideo toe om dit als videotemplate te gebruiken.' : 'In deze categorie staan nog geen prompts of posttemplates.';
    rows.push(empty);
  }
  $('library').replaceChildren(...rows);
}

function refreshDocumentPrompts() {
  const current = $('document-prompt-select').value;
  const items = [...builtInPrompts, ...documentPrompts];
  setOptions($('document-prompt-select'), [['', 'Kies een documentprompt'], ...items.map(item => [item.id, item.name])]);
  $('document-prompt-select').value = items.some(item => item.id === current) ? current : '';
}

function refreshCopyTopic() {
  const topic = $('copy-topic').value;
  $('example-copy').value = examples[topic] || '';
  const items = captionPrompts.filter(item => item.category === categoryFor({ topic }));
  const select = $('caption-prompt-select');
  const current = select.value;
  setOptions(select, [['', 'Kies een prompt'], ...items.map(item => [item.id, item.name])]);
  select.value = items.some(item => item.id === current) ? current : '';
  $('caption-prompt-label').hidden = items.length === 0;
}

function useCaptionPrompt(item) {
  setWritingMode('caption');
  const topic = categoryTopics[item.category] || 'Overig';
  const select = $('copy-topic');
  if (![...select.options].some(option => option.value === topic)) select.add(new Option(topic, topic));
  select.value = topic;
  refreshCopyTopic();
  $('caption-prompt-select').value = item.id;
  $('prompt').value = item.prompt;
  showTab('text');
  $('prompt').focus();
}

function editLibraryPrompt(item) {
  editingPromptId = item?.id;
  const documentMode = libraryCategory === 'documents';
  const label = documentMode ? 'Documentprompt' : 'Bijschriftprompt';
  $('prompt-template-name').value = item?.name || '';
  $('prompt-template-name').placeholder = documentMode ? 'Bijvoorbeeld Waardebepalingsbrief' : 'Bijvoorbeeld Bijschrift voor een nieuwe woning';
  $('prompt-template-text').value = item?.prompt || '';
  $('prompt-template-text').placeholder = documentMode ? 'Beschrijf het gewenste document, de onderdelen en de toon.' : 'Beschrijf wat ChatGPT moet schrijven.';
  $('caption-prompt-category').value = item?.category || libraryCategory;
  $('prompt-form-heading').textContent = label + (item ? ' wijzigen' : ' toevoegen');
  $('cancel-prompt-template').hidden = !item;
  if (item) $('prompt-template-name').focus();
}

function renderWritingModel() {
  const feedback = $('writing-model-status');
  feedback.textContent = writingDrafts[writingMode].model;
  feedback.hidden = !feedback.textContent;
}

function setWritingMode(mode) {
  if (mode !== writingMode) {
    Object.assign(writingDrafts[writingMode], { prompt: $('prompt').value, output: $('copy-output').value });
    writingMode = mode;
    $('prompt').value = writingDrafts[mode].prompt;
    $('copy-output').value = writingDrafts[mode].output;
  }
  const documentMode = mode === 'document';
  $('caption-settings').hidden = documentMode;
  $('save-caption-draft').hidden = documentMode;
  ['document-settings', 'document-details-label', 'export-document'].forEach(id => { $(id).hidden = !documentMode; });
  $('generate-text').textContent = documentMode ? 'Document genereren' : 'Tekst genereren';
  $('output-heading').textContent = documentMode ? 'Conceptdocument' : 'Concepttekst';
  renderWritingModel();
  modeButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.writingMode === mode)));
}

function useDocumentPrompt(item) {
  setWritingMode('document');
  $('document-prompt-select').value = item.id;
  $('document-title').value = item.name;
  $('prompt').value = item.prompt;
  showTab('text');
  $('document-details').focus();
}

categoryButtons.forEach(button => button.onclick = () => selectLibraryCategory(button.dataset.category));
modeButtons.forEach(button => button.onclick = () => setWritingMode(button.dataset.writingMode));
$('show-video-library').onclick = () => openLibrary('video');
$('show-document-library').onclick = () => openLibrary('documents');
$('document-prompt-select').onchange = () => {
  const item = [...builtInPrompts, ...documentPrompts].find(item => item.id === $('document-prompt-select').value);
  if (item) useDocumentPrompt(item);
};
$('caption-prompt-select').onchange = () => {
  const item = captionPrompts.find(item => item.id === $('caption-prompt-select').value);
  if (item) useCaptionPrompt(item);
};
$('save-caption-draft').onclick = () => {
  const prompt = $('prompt').value.trim();
  if (!prompt) return status('Schrijf eerst een instructie om als prompt te bewaren.');
  openLibrary(categoryFor({ topic: $('copy-topic').value }));
  editLibraryPrompt();
  $('prompt-template-text').value = prompt;
  $('prompt-template-name').focus();
};
$('cancel-prompt-template').onclick = () => editLibraryPrompt();
$('save-prompt-template').onclick = () => {
  const name = $('prompt-template-name').value.trim();
  const prompt = $('prompt-template-text').value.trim();
  if (!name || !prompt) return status('Vul een naam en prompt in.');
  const isDocument = libraryCategory === 'documents';
  const category = $('caption-prompt-category').value;
  const prompts = isDocument ? documentPrompts : captionPrompts;
  const item = { id: editingPromptId || crypto.randomUUID(), name, prompt };
  if (!isDocument) item.category = category;
  const next = editingPromptId ? prompts.map(saved => saved.id === editingPromptId ? item : saved) : [...prompts, item];
  try {
    localStorage.setItem(isDocument ? 'wg-document-prompts' : 'wg-caption-prompts', JSON.stringify(next));
    if (isDocument) {
      documentPrompts.splice(0, documentPrompts.length, ...next);
      refreshDocumentPrompts();
    } else {
      captionPrompts = next;
      libraryCategory = category;
      refreshCopyTopic();
    }
    editLibraryPrompt();
    renderTemplateLibrary();
    status(isDocument ? 'Documentprompt opgeslagen.' : 'Prompt opgeslagen bij ' + categoryNames[category] + '.');
  } catch (error) { status(error.message); }
};
$('export-document').onclick = async () => {
  const body = $('copy-output').value.trim();
  if (!body) return status('Maak of plak eerst een conceptdocument.');
  if (!window.desktop) return status('Open de desktopapp om een document op te slaan.');
  try {
    if (await window.desktop.saveDocument({ title: $('document-title').value.trim(), body })) status('Word-compatibel document opgeslagen.');
  } catch (error) { status(error.message); }
};

setOptions($('caption-prompt-category'), Object.keys(categoryTopics).map(category => [category, categoryNames[category]]));
editLibraryPrompt();
refreshDocumentPrompts();
setWritingMode('caption');
showTab('design');
refreshLibrary();
loadImage('voorbeeldwoning.jpg').then(image => {
  if (!photo) { photo = image; render(); }
}).catch(() => {});
libraryRequest('readonly', store => store.getAll()).then(items => {
  if (items.length) { templates.push(...items); refreshLibrary(); }
}).catch(error => status('Kan lokale templates niet lezen. ' + error.message));
