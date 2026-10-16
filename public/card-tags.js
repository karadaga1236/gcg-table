const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function abilityTags(card){
 const result=[];
 for(const raw of (card.effect||'').split('\n')){
  const line=raw.trim(),leading=line.match(/^(?:【[^】]+】)*(?:《[^》]+》)+/)?.[0];
  if(leading){const tail=line.slice(leading.length).trim();if(!tail||/^[（(]/.test(tail)||leading.startsWith('【')&&tail.startsWith('を得る'))for(const m of leading.matchAll(/《([^》]+)》/g))result.push((leading.startsWith('【')?'条件：':'')+m[1])}
  const granted=line.match(/(?:このユニット|これは|これを)[^。]*?《([^》]+)》を得る/);if(granted)result.push('条件：'+granted[1]);
 }
 return [...new Set(result)];
}
export function cardTags(card,battle=[]){
 const tags=abilityTags(card);if(card.type==='ユニット')for(const p of battle.filter(c=>c.attachedTo===card.id))tags.push(...abilityTags(p));
 return {level:card.token?0:card.level,abilities:[...new Set(tags)]};
}
export function tagsMarkup(card,battle=[]){if(card.hidden)return '';const t=cardTags(card,battle);return `<span class="card-tags">${t.level==null?'':`<span>Lv.${E(t.level)}</span>`}${t.abilities.map(a=>`<span class="ability-tag">${E(a)}</span>`).join('')}</span>`}
