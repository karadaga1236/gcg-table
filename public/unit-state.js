export function linked(unit,battle){
 const pilot=battle.find(c=>c.attachedTo===unit.id);if(!pilot)return false;
 const rule=(unit.link||'').normalize('NFKC').trim(),name=(pilot.pilotName||pilot.name||'').normalize('NFKC');
 const names=[...rule.matchAll(/「([^」]+)」/g)].map(m=>m[1]),traits=[...rule.matchAll(/〔([^〕]+)〕/g)].map(m=>m[1]);
 if(rule.replace(/「[^」]+」|〔[^〕]+〕|特徴|\s/g,''))return false;
 return names.some(n=>name.includes(n))||traits.some(t=>(pilot.traits||'').normalize('NFKC').includes('〔'+t+'〕'));
}
export function deployment(unit,battle,round){
 if(unit.type!=='ユニット'||unit.deployedTurn!==round)return '';
 if(unit.attackReady===true)return '攻撃可（手動）';
 if(unit.attackReady!==false&&linked(unit,battle))return 'LINK';
 return '召喚酔い';
}
