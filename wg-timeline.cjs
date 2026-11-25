const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const n = value => Number(value.toFixed(8));

function makeWgTimeline(duration, suggestedEnd, points) {
  const end = Number.isFinite(suggestedEnd)
    ? clamp(suggestedEnd, Math.min(duration, Math.max(4, duration * .55)), duration)
    : duration;
  if (end <= 24) return { end, duration: end, expression: 'PTS' };

  const opening = 2;
  const closing = end - 1.3;
  const middle = [{ time: 2.45, weight: 1 }, ...(Array.isArray(points) ? points : []),
    { time: closing - .45, weight: 1 }].filter(point => Number.isFinite(point?.time) && Number.isFinite(point?.weight)
      && point.time > opening && point.time < closing)
    .slice(0, 14).sort((a, b) => a.time - b.time);
  const knots = [{ time: opening, weight: 1 }];
  for (const point of middle) {
    if (point.time - knots.at(-1).time >= .16 && closing - point.time >= .16) {
      knots.push({ time: point.time, weight: clamp(point.weight, .55, 1.7) });
    }
  }
  knots.push({ time: closing, weight: 1 });
  function paces(scale) {
    return knots.map((knot, index) => index === 0 || index === knots.length - 1 ? 1 : clamp(knot.weight * scale, .18, 1));
  }
  function total(pace) {
    return knots.slice(1).reduce((sum, knot, index) => sum +
      (knot.time - knots[index].time) * (pace[index] + pace[index + 1]) / 2, opening + 1.3);
  }
  let low = 0, high = 2;
  for (let i = 0; i < 28; i++) {
    const middle = (low + high) / 2;
    if (total(paces(middle)) < 24) low = middle;
    else high = middle;
  }
  const pace = paces((low + high) / 2);
  const pieces = [];
  let outputTime = opening;
  for (let i = 0; i < knots.length - 1; i++) {
    const start = knots[i].time, stop = knots[i + 1].time;
    const dt = stop - start;
    const elapsed = '(T-' + n(start) + ')';
    pieces.push({ stop, formula: n(outputTime) + '+' + n(pace[i]) + '*' + elapsed + '+('
      + n((pace[i + 1] - pace[i]) / (2 * dt)) + ')*' + elapsed + '*' + elapsed });
    outputTime += dt * (pace[i] + pace[i + 1]) / 2;
  }
  let expression = n(outputTime) + '+(T-' + n(closing) + ')';
  for (const { stop, formula } of pieces.reverse()) expression = 'if(lt(T,' + n(stop) + '),' + formula + ',' + expression + ')';
  return { end, duration: total(pace), expression: "'if(lt(T,2),T," + expression + ")/TB'" };
}

module.exports = { makeWgTimeline };
