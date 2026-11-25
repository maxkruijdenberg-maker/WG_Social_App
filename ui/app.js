const $ = id => document.getElementById(id);
const fields = ['format', 'position', 'brightness', 'headline', 'subtitle', 'show-logo'];
const defaults = [
  { id: 'sale', topic: 'Nieuw in verkoop', name: 'WG · Nieuw in verkoop', headline: 'Nu te koop', color: '#19375e' },
  { id: 'sold', topic: 'Verkocht', name: 'WG · Verkocht', headline: 'Verkocht', color: '#14635b' },
  { id: 'open', topic: 'Open huis', name: 'WG · Open huis', headline: 'Open huis', color: '#195d9f' }
];
const icons = {
  layout: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  sparkles: '<path d="M12 3c0 6-3 9-9 9 6 0 9 3 9 9 0-6 3-9 9-9-6 0-9-3-9-9ZM19 3v4m-2-2h4"/>',
  video: '<rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m3 19 5-5 3 3 5-6 5 6"/>',
  send: '<path d="m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13"/>',
  expand: '<path d="M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5"/>',
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
  $('export-image').hidden = $('go-publish').hidden = id !== 'design';
  if (id === 'publish') refreshPublishPreview();
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
  if (!$('publish').hidden) refreshPublishPreview();
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
  setOptions($('copy-topic'), topics.map(name => [name, name]));
  $('copy-topic').value = topics.includes(copyTopic) ? copyTopic : topic;
  $('example-copy').value = examples[$('copy-topic').value] || '';
  $('topics').replaceChildren(...topics.map(name => new Option(name)));
  $('library').replaceChildren(...templates.map(template => {
    const button = document.createElement('button');
    button.className = 'library-row';
    const thumb = document.createElement('span');
    thumb.className = 'thumb';
    thumb.style.backgroundColor = template.color;
    const label = document.createElement('span');
    const title = document.createElement('strong');
    const category = document.createElement('small');
    title.textContent = template.name;
    category.textContent = template.topic;
    label.append(title, category);
    button.append(thumb, label);
    button.onclick = () => {
      $('topic').value = template.topic;
      refreshTemplateOptions(template.topic, template.id);
      showTab('design');
    };
    return button;
  }));
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
  const topic = $('template-topic').value.trim();
  const name = $('template-name').value.trim();
  const file = $('template-file').files[0];
  if (!topic || !name || !file) return status('Vul onderwerp en naam in en kies een afbeelding.');
  try {
    const image = await imageFromFile(file);
    const mode = $('template-mode').value;
    if (mode === 'overlay' && file.type !== 'image/png') return status('Gebruik een transparante PNG voor een overlay.');
    const template = { id: crypto.randomUUID(), name, topic, file, mode, headline: topic, color: referenceColor(image), ratio: image.width / image.height, width: image.width, height: image.height };
    await libraryRequest('readwrite', store => store.add(template));
    templates.push(template);
    refreshLibrary(topic, template.id);
    ['template-topic', 'template-name', 'template-file'].forEach(id => { $(id).value = ''; });
    status('Template opgeslagen bij ' + topic + '.');
  } catch (error) { status(error.message); }
};

$('copy-topic').onchange = () => { $('example-copy').value = examples[$('copy-topic').value] || ''; };
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
  try {
    const example = $('example-copy').value.trim();
    $('copy-output').value = await window.desktop.writeText({
      key: $('api-key').value,
      prompt: ['Onderwerp: ' + $('copy-topic').value, 'Opdracht: ' + prompt,
        example && 'Gebruik dit voorbeeld alleen als stijlgids:\n' + example].filter(Boolean).join('\n\n')
    });
    if (!$('copy-output').value) status('OpenAI heeft geen tekst teruggegeven.');
  } catch (error) { status(error.message); }
  finally { $('generate-text').disabled = false; }
};
$('copy-text').onclick = async () => {
  if (!$('copy-output').value) return status('Er is nog geen concepttekst om te kopiëren.');
  try { await navigator.clipboard.writeText($('copy-output').value); status('Tekst gekopieerd.'); }
  catch { status('Kopiëren is niet gelukt. Selecteer de tekst en gebruik Ctrl+C.'); }
};

let videoUrl;
let clipEnd;
const player = $('player');
$('open-video').onclick = async () => {
  if (!window.desktop) return status('Open de desktopapp om een video te bewerken.');
  try {
    const file = await window.desktop.openVideo();
    if (!file) return;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    clipEnd = undefined;
    $('export-video').disabled = $('play-clip').disabled = true;
    resetMontage();
    $('source-name').textContent = file.name;
    videoUrl = URL.createObjectURL(new Blob([file.bytes], { type: 'video/mp4' }));
    updateMontageAction();
    player.src = videoUrl;
  } catch (error) { status(error.message); }
};
player.onloadedmetadata = () => {
  $('video-empty').hidden = true;
  player.hidden = false;
  $('video-start').value = 0;
  $('video-end').value = player.duration;
  $('export-video').disabled = $('play-clip').disabled = !Number.isFinite(player.duration);
};
player.onerror = () => {
  player.hidden = true;
  $('video-empty').hidden = false;
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
  $('export-video').disabled = $('open-video').disabled = true;
  status('Video exporteren…');
  try {
    if (await window.desktop.exportVideo({ ...range, muted: $('mute-video').checked })) {
      status('MP4 opgeslagen.');
    }
  } catch (error) { status(error.message); }
  finally { $('export-video').disabled = $('open-video').disabled = false; }
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

async function toggleFullscreen() {
  try {
    if (window.desktop) {
      await window.desktop.toggleFullscreen();
    } else if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  } catch (error) { status(error.message); }
}
$('fullscreen').onclick = toggleFullscreen;
document.addEventListener('keydown', event => {
  if (event.key === 'F11') {
    event.preventDefault();
    toggleFullscreen();
  }
});

let reference;
let montageUrl;
let makingMontage = false;
const montagePlayer = $('montage-player');
function showVideo(which) {
  const showMontage = which === 'montage' && Boolean(montageUrl);
  (showMontage ? player : montagePlayer).pause();
  montagePlayer.hidden = !showMontage;
  player.hidden = showMontage || !videoUrl || player.readyState < 1;
  $('video-empty').hidden = showMontage || !player.hidden;
  $('view-source').setAttribute('aria-pressed', String(!showMontage));
  $('view-montage').setAttribute('aria-pressed', String(showMontage));
}
function resetMontage() {
  if (montageUrl) {
    montagePlayer.pause();
    montagePlayer.removeAttribute('src');
    montagePlayer.load();
    URL.revokeObjectURL(montageUrl);
  }
  montageUrl = undefined;
  ['view-source', 'view-montage', 'save-montage', 'montage-summary', 'montage-status'].forEach(id => { $(id).hidden = true; });
  showVideo('source');
}
function updateMontageAction() {
  $('generate-montage').disabled = !videoUrl || !reference || makingMontage;
}
$('view-source').onclick = () => showVideo('source');
$('view-montage').onclick = () => showVideo('montage');
$('open-reference').onclick = async () => {
  if (!window.desktop) return status('Open de desktopapp om een voorbeeldvideo te selecteren.');
  try {
    const name = await window.desktop.openVideoReference();
    if (!name) return;
    reference = name;
    $('reference-name').textContent = name;
    resetMontage();
    updateMontageAction();
  } catch (error) { status(error.message); }
};
$('generate-montage').onclick = async () => {
  makingMontage = true;
  updateMontageAction();
  $('open-video').disabled = $('open-reference').disabled = true;
  const feedback = $('montage-status');
  feedback.hidden = false;
  feedback.textContent = 'Beelden analyseren en de montage maken…';
  try {
    const result = await window.desktop.generateMontage({
      key: $('video-key').value.trim() || $('api-key').value,
      prompt: $('video-prompt').value.trim(),
      showLogo: $('video-logo').checked
    });
    resetMontage();
    montageUrl = URL.createObjectURL(new Blob([result.bytes], { type: 'video/mp4' }));
    montagePlayer.src = montageUrl;
    $('montage-summary').textContent = result.summary;
    ['view-source', 'view-montage', 'save-montage', 'montage-summary'].forEach(id => { $(id).hidden = false; });
    showVideo('montage');
  } catch (error) { feedback.textContent = error.message; }
  finally {
    makingMontage = false;
    $('open-video').disabled = $('open-reference').disabled = false;
    updateMontageAction();
  }
};
$('save-montage').onclick = async () => {
  try {
    if (await window.desktop.saveMontage()) status('AI-montage opgeslagen.');
  } catch (error) { status(error.message); }
};

let publishPreviewUrl;
let accountsConnected = false;
let sentPost;
function refreshPublishPreview() {
  canvas.toBlob(blob => {
    if (!blob) return;
    if (publishPreviewUrl) URL.revokeObjectURL(publishPreviewUrl);
    publishPreviewUrl = URL.createObjectURL(blob);
    $('publish-image').src = publishPreviewUrl;
  }, 'image/jpeg', .94);
}
$('go-publish').onclick = () => showTab('publish');
$('import-caption').onclick = () => { $('publish-caption').value = $('copy-output').value; };
$('connect-social').onclick = async () => {
  if (!window.desktop) return status('Open de desktopapp om je accounts te koppelen.');
  const button = $('connect-social');
  const feedback = $('connection-status');
  button.disabled = true;
  try {
    const accounts = await window.desktop.connectSocial({ pageId: $('page-id').value.trim(), token: $('page-token').value });
    feedback.textContent = 'Gekoppeld · ' + accounts.facebook + ' en @' + accounts.instagram;
    accountsConnected = true;
    $('page-token').value = '';
  } catch (error) { feedback.textContent = error.message; }
  finally {
    button.disabled = false;
    $('publish-post').disabled = !accountsConnected;
  }
};
$('publish-post').onclick = async () => {
  const button = $('publish-post');
  const feedback = $('publish-feedback');
  button.disabled = $('connect-social').disabled = true;
  try {
    const caption = $('publish-caption').value.trim();
    const { width, height } = canvas;
    const image = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .94));
    const bytes = new Uint8Array(await image.arrayBuffer());
    const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).join(',');
    if (sentPost?.fingerprint === fingerprint && sentPost?.caption === caption) {
      throw new Error('Deze post is al verzonden. Controleer de resultaten per account voordat je verdergaat.');
    }
    const result = await window.desktop.publishSocial({
      bytes, width, height, caption,
      cloud: $('cloud-name').value.trim(), preset: $('cloud-preset').value.trim()
    });
    if (!result) return;
    sentPost = { fingerprint, caption };
    feedback.hidden = false;
    feedback.textContent = [['Facebook', result.facebook], ['Instagram', result.instagram]].map(([name, delivery]) => (
      name + (delivery.id ? ' · gepubliceerd (' + delivery.id + ')' : ' · controleer je account: ' + delivery.error)
    )).join('\n');
  } catch (error) { status(error.message); }
  finally { button.disabled = !accountsConnected; $('connect-social').disabled = false; }
};

showTab('design');
refreshLibrary();
loadImage('voorbeeldwoning.jpg').then(image => {
  if (!photo) { photo = image; render(); }
}).catch(() => {});
libraryRequest('readonly', store => store.getAll()).then(items => {
  if (items.length) { templates.push(...items); refreshLibrary(); }
}).catch(error => status('Kan lokale templates niet lezen. ' + error.message));
