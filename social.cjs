const graph = 'https://graph.facebook.com/v25.0/';

async function meta(url, token, data) {
  const response = await fetch(graph + url, {
    headers: { Authorization: 'Bearer ' + token },
    ...(data ? { method: 'POST', body: data } : {}),
    signal: AbortSignal.timeout(45000)
  });
  const body = await response.json();
  if (!response.ok || body.error) {
    throw new Error(body.error?.message || 'Meta-aanvraag mislukt (HTTP ' + response.status + ').');
  }
  return body;
}

async function connect({ pageId, token }) {
  if (!/^\d+$/.test(pageId) || !token?.trim()) throw new Error('Vul je Facebook-pagina-ID en paginatoegangstoken in.');
  const credentials = token.trim();
  const page = await meta(pageId + '?fields=id,name,instagram_business_account{id,username}', credentials);
  if (!page.instagram_business_account?.id) {
    throw new Error('Koppel eerst een professioneel Instagram-account aan deze Facebook-pagina.');
  }
  return { pageId: page.id, pageName: page.name, instagram: page.instagram_business_account, token: credentials };
}

async function hostImage(image, cloud, preset) {
  if (!/^[\w-]+$/.test(cloud) || !/^[\w-]+$/.test(preset)) throw new Error('Vul de Cloudinary-cloudnaam en uploadpreset in.');
  const data = new FormData();
  data.set('upload_preset', preset);
  data.set('file', image, 'WG-social-post.jpg');
  const response = await fetch('https://api.cloudinary.com/v1_1/' + cloud + '/image/upload', {
    method: 'POST', body: data, signal: AbortSignal.timeout(45000)
  });
  const body = await response.json();
  if (!response.ok || !body.secure_url?.startsWith('https://res.cloudinary.com/')) {
    throw new Error(body.error?.message || 'Cloudinary kon de afbeelding niet beschikbaar maken.');
  }
  return body.secure_url;
}

async function instagramContainer(id, token) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const { status_code: status } = await meta(id + '?fields=status_code', token);
    if (status === 'FINISHED') return;
    if (status === 'PUBLISHED') throw new Error('Deze Instagram-post is al gepubliceerd.');
    if (status === 'ERROR' || status === 'EXPIRED') throw new Error('Instagram heeft de afbeelding niet kunnen verwerken.');
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  throw new Error('Instagram verwerkt de afbeelding nog. Controleer je account voordat je opnieuw probeert.');
}

async function publish(connection, { bytes, width, height, caption, cloud, preset }) {
  const ratio = width / height;
  if (!bytes?.length || bytes.length > 8 * 1024 * 1024 || !Number.isFinite(ratio) || ratio < .8 || ratio > 1.92) {
    throw new Error('Kies voor Instagram een feedformaat van 4:5, 1:1 of 1,91:1 en een afbeelding kleiner dan 8 MB.');
  }
  if (typeof caption !== 'string' || caption.length > 2200) throw new Error('Gebruik maximaal 2200 tekens.');
  const { pageId, instagram, token } = connection;
  const image = new Blob([bytes], { type: 'image/jpeg' });
  const imageUrl = await hostImage(image, cloud, preset);
  // Prepare Instagram first, so a rejected image creates no post on Facebook.
  const container = await meta(instagram.id + '/media', token, new URLSearchParams({
    image_url: imageUrl, caption
  }));
  await instagramContainer(container.id, token);

  const photo = new FormData();
  photo.set('source', image, 'WG-social-post.jpg');
  photo.set('caption', caption);
  const results = await Promise.allSettled([
    meta(pageId + '/photos', token, photo),
    meta(instagram.id + '/media_publish', token, new URLSearchParams({ creation_id: container.id }))
  ]);
  return Object.fromEntries(results.map((result, index) => [
    index === 0 ? 'facebook' : 'instagram',
    result.status === 'fulfilled'
      ? { id: result.value.post_id || result.value.id }
      : { error: result.reason.message }
  ]));
}

module.exports = { connect, publish };
