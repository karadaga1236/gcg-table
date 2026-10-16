export function printedCost(card, byNumber = new Map()) {
 const raw = byNumber.get(card.number)?.cost ?? card.cost;
 return /^(0|[1-9]\d?)$/.test(String(raw ?? '')) ? Number(raw) : null;
}
// Sort only the display; preserve saved order and copy counts.
export function cardsByCost(cards, byNumber = new Map()) {
 return [...cards].sort((a,b) =>
  (printedCost(a,byNumber) ?? Infinity) - (printedCost(b,byNumber) ?? Infinity)
  || a.number.localeCompare(b.number));
}
