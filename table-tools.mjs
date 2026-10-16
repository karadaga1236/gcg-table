import {randomBytes,randomInt} from 'node:crypto';
const check=(ok,message)=>{if(!ok)throw Error(message)};
const uid=()=>randomBytes(18).toString('hex');
const say=(r,i,text)=>{r.log.unshift(`${r.players[i].name}：${text}`);r.log=r.log.slice(0,100)};
const mixed=cards=>{const result=[...cards];for(let n=result.length-1;n>0;n--){const j=randomInt(n+1);[result[n],result[j]]=[result[j],result[n]]}return result};
function idsFrom(list,ids){check(Array.isArray(ids)&&ids.length<=50&&new Set(ids).size===ids.length,'カードの選択が不正です。');const result=ids.map(id=>list.find(c=>c.id===id));check(result.every(Boolean),'選んだカードが更新されています。選び直してください。');return result}
export function announce(r,i,cards){if(!cards.length)return;const entry={id:uid(),player:i,cards:cards.map(c=>({...structuredClone(c),id:uid(),attachedTo:null})),text:`${r.players[i].name}が${cards.length}枚を公開`};r.reveals=[entry,...(r.reveals||[])].slice(0,10)}
export function privateTools(p,own,revision){return {peek:own&&p.peek?{cards:structuredClone(p.deck.slice(0,p.peek.ids.length)),count:p.peek.ids.length}:p.peek?{count:p.peek.ids.length}:null,canUndoPayment:own&&p.paymentUndo?.revision===revision}}
export function guardDeck(r,i,a){
 if(a.type==='phase')check(!r.players.some(p=>p.peek),'デッキ上部の確認を完了してからフェイズを進めてください。');
 if(!r.players[i].peek)return;
 check(!['draw','shuffle','search','peek'].includes(a.type)&&!(['move','batchMove'].includes(a.type)&&(a.from==='deck'||a.to==='deck')),'上から見たカードを確定するか、確認を取り消してください。');
}
export function readyCard(c){if(c.skipRefresh){c.skipRefresh=false;return false}c.rest=false;return true}
export function expireTurn(r){for(const p of r.players)for(const z of ['battle','base','resources'])for(const c of p[z]){if(c.modifier?.duration==='turn')delete c.modifier;if(c.effects)c.effects=c.effects.filter(e=>e.duration!=='turn')}}
export function handleTools(r,i,a){
 const p=r.players[i];
 if(a.type==='pay'){
  check(Number.isInteger(a.count)&&a.count>=1&&a.count<=30,'支払う枚数を1〜30で指定してください。');check(a.useEX===undefined||typeof a.useEX==='boolean','EXの指定が不正です。');
  const ex=a.useEX?p.resources.find(c=>c.number==='EXR-001'&&!c.rest):null;
  check(!a.useEX||ex,'アクティブのEXリソースがありません。');
  const normal=p.resources.filter(c=>!c.rest&&c.number!=='EXR-001');const count=a.count-(ex?1:0);check(normal.length>=count,'アクティブのリソースが足りません。');
  p.paymentUndo={revision:r.revision+1,resources:structuredClone(p.resources),removed:structuredClone(p.removed)};
  normal.slice(0,count).forEach(c=>c.rest=true);if(ex){p.resources=p.resources.filter(c=>c!==ex);p.removed.push(ex)}say(r,i,`${a.count}コストを支払い${ex?'（EXリソースを含む）':''}`);return true;
 }
 if(a.type==='undoPayment'){check(p.paymentUndo?.revision===r.revision,'支払い直後だけ取り消せます。以後は手動で戻してください。');p.resources=p.paymentUndo.resources;p.removed=p.paymentUndo.removed;p.paymentUndo=null;say(r,i,'直前の支払いを取り消し');return true}
 if(a.type==='peek'){
  check(!p.peek&&Number.isInteger(a.count)&&a.count>=1&&a.count<=50,'見る枚数を1〜50で指定してください。');check(p.deck.length,'山札が空です。');p.peek={ids:p.deck.slice(0,a.count).map(c=>c.id)};say(r,i,`デッキの上から${p.peek.ids.length}枚を確認（内容は非公開）`);return true;
 }
 if(a.type==='cancelPeek'){check(p.peek,'確認中のカードがありません。');p.peek=null;say(r,i,'デッキ上部の確認を取り消し（順序はそのまま）');return true}
 if(a.type==='finishPeek'){
  check(p.peek,'確認中のカードがありません。');const top=p.deck.slice(0,p.peek.ids.length);check(top.every((c,n)=>c.id===p.peek.ids[n]),'山札が更新されています。');
  const selected=idsFrom(top,a.ids);check(['hand','resolving','trash','removed','battle','base'].includes(a.to),'移動先が不正です。');check(typeof a.reveal==='boolean','公開の指定が不正です。');check(['top','bottom','randomBottom'].includes(a.remainder),'残りの戻し方を選んでください。');
  let remaining=top.filter(c=>!a.ids.includes(c.id));if(a.order!==undefined){const ordered=idsFrom(remaining,a.order);check(ordered.length===remaining.length,'残りのカードすべての順序を指定してください。');remaining=ordered}
  check(p[a.to].length+selected.length<=100,'移動先がいっぱいです。');
  // Everything is validated before the deck or public information changes.
  const tail=p.deck.slice(top.length);if(a.reveal)announce(r,i,selected);
  if(a.remainder==='randomBottom')remaining=mixed(remaining);
  p.deck=a.remainder==='top'?[...remaining,...tail]:[...tail,...remaining];
  for(const c of selected){c.attachedTo=null;c.rest=false;c.damage=0;delete c.modifier;delete c.skipRefresh;delete c.effects;delete c.deployedTurn;delete c.attackReady;if(a.to==='battle'&&c.type==='ユニット')c.deployedTurn=r.round;if(a.to==='hand')c.id=uid();p[a.to].push(c)}
  p.peek=null;say(r,i,`確認した${top.length}枚から${selected.length}枚を${{hand:'手札',resolving:'効果処理中',trash:'トラッシュ',removed:'除外',battle:'バトル',base:'ベース'}[a.to]}へ${a.reveal?'（選択カードを公開）':''}。残りは${{top:'上',bottom:'指定順で下',randomBottom:'無作為に下'}[a.remainder]}へ`);return true;
 }
 if(a.type==='revealCards'){check(['hand','battle','base','trash','removed','resolving'].includes(a.from),'公開できる領域を選んでください。');const cards=idsFrom(p[a.from],a.ids);check(cards.length,'公開するカードを選んでください。');announce(r,i,cards);say(r,i,`${cards.length}枚を公開`);return true}
 if(a.type==='bulkModifier'){
  const cards=idsFrom(p.battle,a.ids);check(cards.length&&cards.every(c=>c.type==='ユニット'&&!c.attachedTo),'自分のユニットを選んでください。');
  check([a.ap,a.hp].every(n=>Number.isInteger(n)&&Math.abs(n)<=99)&&typeof a.note==='string'&&a.note.length<=140&&['turn','manual'].includes(a.duration),'補正・メモ・期限の指定が不正です。');check(cards.every(c=>(c.effects||[]).length<30),'追加できる効果数を超えています。');
  const effect={id:uid(),ap:a.ap,hp:a.hp,note:a.note,duration:a.duration};for(const c of cards)(c.effects||=[]).push({...effect});say(r,i,cards.length+'体へ一括補正（AP '+a.ap+' / HP '+a.hp+'）');return true;
 }
 if(a.type==='clearBulkModifier'){
  check(typeof a.id==='string'&&p.battle.some(c=>c.effects?.some(e=>e.id===a.id)),'解除する自分の効果を選んでください。');for(const c of p.battle)if(c.effects)c.effects=c.effects.filter(e=>e.id!==a.id);say(r,i,'選択した一括補正を解除');return true;
 }
 if(a.type==='modifier'){
  check(['battle','base','resources'].includes(a.from),'場のカードを選んでください。');const c=p[a.from].find(c=>c.id===a.id);check(c,'自分のカードを選んでください。');
  check([a.ap,a.hp].every(n=>Number.isInteger(n)&&Math.abs(n)<=99),'AP・HP補正は−99〜99で指定してください。');check(typeof a.note==='string'&&a.note.length<=140,'効果メモは140文字までです。');check(['manual','turn'].includes(a.duration)&&typeof a.skipRefresh==='boolean','期限・アクティブ化の指定が不正です。');
  c.modifier={ap:a.ap,hp:a.hp,note:a.note,duration:a.duration};c.skipRefresh=a.skipRefresh;say(r,i,`${c.name}の補正を設定（AP ${a.ap>=0?'+':''}${a.ap} / HP ${a.hp>=0?'+':''}${a.hp}${a.skipRefresh?'・次の自分のスタートでアクティブにしない':''}）`);return true;
 }
 return false;
}
