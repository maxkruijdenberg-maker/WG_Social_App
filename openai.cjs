const { randomUUID } = require('node:crypto');
const { readFile, rename, rm, writeFile } = require('node:fs/promises');

function createKeyStore(safeStorage, filename, environmentKey) {
  function encryptedStorageAvailable() {
    return safeStorage.isEncryptionAvailable() &&
      !(process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text');
  }

  async function read() {
    const encrypted = await readFile(filename).catch(error => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (!encrypted) return null;
    if (!encryptedStorageAvailable()) throw new Error('Beveiligde opslag is niet beschikbaar voor dit gebruikersaccount.');
    try {
      return safeStorage.decryptString(encrypted);
    } catch {
      throw new Error('De opgeslagen API-sleutel is onleesbaar. Sla je sleutel opnieuw op bij Instellingen.');
    }
  }

  return {
    async status() {
      if (await read()) return 'saved';
      return environmentKey ? 'environment' : 'missing';
    },
    async save(value) {
      const key = typeof value === 'string' ? value.trim() : '';
      if (!/^\S{12,512}$/.test(key)) throw new Error('Vul een geldige OpenAI API-sleutel in.');
      if (!encryptedStorageAvailable()) throw new Error('Beveiligde opslag is niet beschikbaar voor dit gebruikersaccount.');
      const temporary = filename + '.' + randomUUID() + '.tmp';
      try {
        await writeFile(temporary, safeStorage.encryptString(key), { mode: 0o600, flag: 'wx' });
        await rename(temporary, filename);
      } finally {
        await rm(temporary, { force: true });
      }
      return 'saved';
    },
    async clear() {
      await rm(filename, { force: true });
      return environmentKey ? 'environment' : 'missing';
    },
    async requireKey() {
      const key = await read() || environmentKey;
      if (!key) throw new Error('Sla je OpenAI API-sleutel op bij Instellingen.');
      return key;
    }
  };
}

async function requestText(token, input, timeout = 60000) {
  let response;
  try {
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4.1-mini', ...input }),
      signal: AbortSignal.timeout(timeout)
    });
  } catch (error) {
    if (error.name === 'TimeoutError') throw new Error('OpenAI reageerde te laat. Probeer het opnieuw.');
    throw new Error('Kan OpenAI niet bereiken. Controleer je internetverbinding.');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    if (response.status === 401) throw new Error('OpenAI weigert de API-sleutel. Controleer of vervang die bij Instellingen.');
    if (response.status === 403 || response.status === 404) throw new Error('Dit OpenAI-project heeft geen toegang tot het vereiste model.');
    if (body.error?.code === 'insufficient_quota' || response.status === 402) {
      throw new Error('Het OpenAI-project heeft geen API-tegoed. Controleer facturering bij OpenAI.');
    }
    if (response.status === 429) throw new Error('De OpenAI-API-limiet is bereikt. Wacht even en probeer het opnieuw.');
    throw new Error('OpenAI weigerde het verzoek (HTTP ' + response.status + ').');
  }
  const payload = await response.json();
  const items = payload.output?.flatMap(item => item.content || []) || [];
  const text = items.filter(item => item.type === 'output_text').map(item => item.text).join('\n');
  if (text.trim()) return text;
  if (items.some(item => item.type === 'refusal')) throw new Error('OpenAI kon deze opdracht niet uitvoeren. Pas de instructie aan.');
  throw new Error('OpenAI gaf geen bruikbaar antwoord terug. Probeer het opnieuw.');
}

module.exports = { createKeyStore, requestText };
