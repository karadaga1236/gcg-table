export function linked(unit,battle){
 const pilot=battle.find(c=>c.attachedTo===unit.id);if(!pilot)return false;
 const rule=(unit.link||'').trim();
 const named=rule.match(/^「([^」]+)」$/);if(named)return (pilot.pilotName||pilot.name)===named[1];
 const trait=rule.match(/^特徴〔([^〕]+)〕$/);return !!trait&&(pilot.traits||'').includes('〔'+trait[1]+'〕');
}
export function deployment(unit,battle,round){
 if(unit.type!=='ユニット'||unit.deployedTurn!==round)return '';
 if(unit.attackReady===true)return '攻撃可（手動）';
 if(unit.attackReady!==false&&linked(unit,battle))return 'LINK';
 return '召喚酔い';
}
