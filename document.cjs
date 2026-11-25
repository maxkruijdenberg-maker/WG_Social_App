function escapeRtf(text) {
  return text.replace(/[\\{}]|[^\x20-\x7e]/g, character => {
    if ('\\{}'.includes(character)) return '\\' + character;
    const code = character.charCodeAt(0);
    return '\\u' + (code > 32767 ? code - 65536 : code) + '?';
  });
}

function createRtf(title, body) {
  const lines = body.replace(/\r\n?/g, '\n').split('\n');
  const sections = lines.map(line => {
    const heading = /^(#{1,3})\s+(.+)/.exec(line);
    if (heading) return '\\pard\\sb240\\sa100\\cf1\\b\\fs' + (heading[1].length === 1 ? 32 : 26)
      + ' ' + escapeRtf(heading[2]) + '\\b0\\par';
    const bullet = /^\s*[-*]\s+(.+)/.exec(line);
    if (bullet) return '\\pard\\li420\\fi-220\\sa85\\fs22\\cf2 \\bullet\\tab ' + escapeRtf(bullet[1]) + '\\par';
    return '\\pard\\sa100\\fs22\\cf2 ' + escapeRtf(line) + '\\par';
  });
  return [
    '{\\rtf1\\ansi\\ansicpg1252\\deff0\\uc1',
    '{\\fonttbl{\\f0 Calibri;}}',
    '{\\colortbl;\\red25\\green55\\blue94;\\red20\\green40\\blue66;\\red242\\green155\\blue66;}',
    '\\paperw11907\\paperh16840\\margl1200\\margr1200\\margt1100\\margb1100',
    '\\pard\\sa130\\cf3\\b\\fs20 WG MAKELAARS\\b0\\par',
    '\\pard\\sa250\\cf1\\b\\fs42 ' + escapeRtf(title) + '\\b0\\par',
    ...sections,
    '}'
  ].join('\n');
}

module.exports = { createRtf };
