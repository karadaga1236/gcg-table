export function matchesSets(card, selected=[]){
 return !selected.length||selected.includes(String(card.number||'').split('-')[0]);
}
export function setOptions(cards){
 const counts=new Map();
 for(const card of cards){const code=String(card.number||'').split('-')[0];if(code)counts.set(code,(counts.get(code)||0)+1)}
 return [...counts].sort(([a],[b])=>a.localeCompare(b));
}
