const defaults = {
  introColor: '0E273B', houseColor: '0E273B', outroColor: '0E273B', accentColor: 'AC9564', textColor: 'FFFFFF',
  targetSeconds: 26.6, openingSeconds: 2, introSeconds: 2.78, cardSeconds: 2.6,
  address: null, city: null, contact: null, showLogo: null
};
const colors = ['introColor', 'houseColor', 'outroColor', 'accentColor', 'textColor'];
const timings = { targetSeconds: [6, 120], openingSeconds: [0.5, 10], introSeconds: [0.5, 10], cardSeconds: [0.5, 12] };
const colorNames = {
  oranje: 'F28C28', donkerblauw: '0E273B', blauw: '195D9F', wit: 'FFFFFF', zwart: '151515',
  goud: 'AC9564', groen: '287348', rood: 'BD392F', geel: 'F9D449', paars: '7142A0', grijs: '657487'
};

const styleSchema = {
  type: 'object', additionalProperties: false, required: Object.keys(defaults),
  properties: Object.fromEntries(Object.keys(defaults).map(key => [
    key, { type: [key === 'showLogo' ? 'boolean' : Object.hasOwn(timings, key) ? 'number' : 'string', 'null'] }
  ]))
};

function normalizeStyle(input, previous = defaults) {
  const result = { ...defaults, ...previous };
  for (const key of colors) {
    if (typeof input?.[key] === 'string' && /^#?[0-9a-f]{6}$/i.test(input[key])) result[key] = input[key].replace('#', '').toUpperCase();
  }
  for (const [key, [min, max]] of Object.entries(timings)) {
    if (Number.isFinite(input?.[key])) result[key] = Math.max(min, Math.min(max, input[key]));
  }
  for (const key of ['address', 'city', 'contact']) {
    if (typeof input?.[key] === 'string') result[key] = input[key].slice(0, key === 'contact' ? 300 : 100);
  }
  if (typeof input?.showLogo === 'boolean') result.showLogo = input.showLogo;
  return result;
}

function simpleColorFeedback(text) {
  const match = text.trim().toLowerCase().match(/^(?:maak |zet )?(?:de |het )?(adresbalk|balkje|balk|huisje|contactkaart|eindkaart|accentlijn|tekst)(?: moet)?(?: op)? (#[0-9a-f]{6}|[a-z]+)(?: zijn| worden)?[.!]?$/);
  if (!match) return null;
  const color = match[2].startsWith('#') ? match[2].slice(1) : colorNames[match[2]];
  if (!color) return null;
  const part = { adresbalk: 'introColor', balkje: 'introColor', balk: 'introColor', huisje: 'houseColor',
    contactkaart: 'outroColor', eindkaart: 'outroColor', accentlijn: 'accentColor', tekst: 'textColor' }[match[1]];
  return { style: { [part]: color }, summary: 'Kleur van ' + match[1] + ' aangepast naar ' + match[2] + '.' };
}

module.exports = { normalizeStyle, simpleColorFeedback, styleSchema };
