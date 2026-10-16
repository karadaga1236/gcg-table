// Copy-weighted printed COST distribution. Catalog data also covers restored drafts.
export function deckCurve(cards, byNumber = new Map()) {
  const counts = new Map();
  let total = 0, known = 0, unknown = 0, sum = 0;
  for (const card of cards) {
    if (!Number.isInteger(card.count) || card.count <= 0) continue;
    total += card.count;
    const raw = byNumber.get(card.number)?.cost ?? card.cost;
    if (!/^(0|[1-9]\d?)$/.test(String(raw ?? ''))) {
      unknown += card.count;
      continue;
    }
    const cost = Number(raw);
    counts.set(cost, (counts.get(cost) || 0) + card.count);
    known += card.count;
    sum += cost * card.count;
  }
  const highest = Math.max(7, ...counts.keys());
  const bins = Array.from({length: highest + 1}, (_, cost) => ({cost, count: counts.get(cost) || 0}));
  return {bins, total, known, unknown, average: known ? sum / known : null};
}
