// Printed stats and attachment bonuses are separate from marked damage.
export function cardStats(card,battle=[]){
 const number=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
 const attached=battle.filter(c=>c.attachedTo===card.id);
 const apBonus=attached.reduce((n,c)=>n+(number(c.ap)||0),0)+(card.modifier?.ap||0)+(card.effects||[]).reduce((n,e)=>n+e.ap,0);
 const hpBonus=attached.reduce((n,c)=>n+(number(c.hp)||0),0)+(card.modifier?.hp||0)+(card.effects||[]).reduce((n,e)=>n+e.hp,0);
 const ap=number(card.ap),hp=number(card.hp);
 return {ap:ap===null?null:ap+apBonus,hp:hp===null?null:hp+hpBonus,apBonus,hpBonus,attached:attached.length};
}
