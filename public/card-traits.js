// Match the card's printed traits, never incidental mentions in effects or links.
export function traitsOf(card){return [...new Set([...String(card.traits||'').matchAll(/〔([^〕]+)〕/g)].map(m=>m[1].trim()).filter(Boolean))]}
export function matchesTrait(card,trait){return !trait||traitsOf(card).includes(trait)}
export function matchesTraits(card,traits=[]){const printed=traitsOf(card);return !traits.length||traits.some(t=>printed.includes(t))}
export function traitOptions(cards){const counts=new Map();for(const c of cards)for(const t of traitsOf(c))counts.set(t,(counts.get(t)||0)+1);return [...counts].sort(([a],[b])=>a.localeCompare(b,'ja'))}
