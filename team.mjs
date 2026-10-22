import {randomBytes} from 'node:crypto';
export const isTeam=r=>r.format==='team';
export const teamOf=i=>i%2;
export const capacity=r=>isTeam(r)?4:2;
export const members=(r,t)=>r.players.map((_,i)=>i).filter(i=>isTeam(r)?teamOf(i)===t:i===t);
export const activeMembers=r=>members(r,r.turn);
const check=(ok,message)=>{if(!ok)throw Error(message)};
const say=(r,i,text)=>{r.log.unshift(`${r.players[i].name}：${text}`);r.log=r.log.slice(0,100)};
const uid=()=>randomBytes(18).toString('hex');
const reset=c=>{c.rest=false;c.damage=0;c.attachedTo=null;for(const key of ['modifier','effects','skipRefresh','deployedTurn','attackReady'])delete c[key]};
export function discardUnit(r,owner,id){
 const p=r.players[owner],c=p.battle.find(c=>c.id===id&&c.type==='ユニット'&&!c.attachedTo);check(c,'入れ替えるユニットを選び直してください。');
 const cards=p.battle.filter(x=>x.id===id||x.attachedTo===id);p.battle=p.battle.filter(x=>!cards.includes(x));
 for(const x of cards){reset(x);p[x.token?'removed':'trash'].push(x)}
 return c;
}
export function beforeTeamAction(r,i,a){
 if(!isTeam(r))return;
 if(a.replaceUnits!==undefined){
  const p=r.players[i];let entering=[];
  if(['move','batchMove'].includes(a.type)&&a.to==='battle'&&a.from!=='battle')entering=p[a.from]?.filter(c=>a.type==='move'?c.id===a.id:a.ids?.includes(c.id))||[];
  if(a.type==='finishPeek'&&a.to==='battle')entering=p.deck.slice(0,p.peek?.ids.length||0).filter(c=>a.ids?.includes(c.id));
  let count=['createToken'].includes(a.type)?a.count:a.type==='token'&&a.to==='battle'?1:entering.filter(c=>c.type==='ユニット').length;
  const total=members(r,teamOf(i)).reduce((n,j)=>n+r.players[j].battle.filter(c=>c.type==='ユニット'&&!c.attachedTo).length,0);
  check(Array.isArray(a.replaceUnits)&&a.replaceUnits.length===Math.max(0,total+count-6),'超過する数だけ入れ替えるユニットを選んでください。');
  check(new Set(a.replaceUnits.map(x=>`${x.player}:${x.id}`)).size===a.replaceUnits.length,'同じユニットは選べません。');
  for(const x of a.replaceUnits){check(Number.isInteger(x.player)&&r.players[x.player]&&teamOf(x.player)===teamOf(i),'自分のチームのユニットを選んでください。');const c=discardUnit(r,x.player,x.id);say(r,i,`${r.players[x.player].name}の${c.name}を上限の入れ替えで場から移動（破壊ではありません）`)}
 }
}
export function normalizeTeams(r,i,a){
 if(!isTeam(r))return;
 for(const [j,p] of r.players.entries()){
  const t=r.teams[teamOf(j)];
  if(p.base.length){
   check(p.base.length===1,'共有ベースに配備できるのは1枚です。');
   if(t.base.length){check(a.replaceBase===t.base[0].id,'共有ベースの入れ替えを確認してください。');const old=t.base.shift();reset(old);r.players[old.owner][old.token?'removed':'trash'].push(old);say(r,i,'共有ベースを入れ替え（破壊ではありません）')}
   const c=p.base.shift();c.owner=j;t.base.push(c);
  }
  if(p.shields.length){const added=p.shields.splice(0);for(const c of added)c.owner=j;t.shields=a.position==='bottom'?[...t.shields,...added]:[...added,...t.shields]}
 }
 for(let t=0;t<2;t++)check(members(r,t).reduce((n,j)=>n+r.players[j].battle.filter(c=>c.type==='ユニット'&&!c.attachedTo).length,0)<=6,'チームのユニットは合計6体までです。入れ替えるユニットを選んでください。');
}
export function setupTeams(r,card){
 r.teams=[{shields:[],base:[]},{shields:[],base:[]}];
 for(let t=0;t<2;t++){
  const [leader,mate]=members(r,t),left=r.players[mate].deck.splice(0,4),right=r.players[leader].deck.splice(0,4);
  // The left player's card is at the bottom; array index 0 is the top.
  for(let n=3;n>=0;n--){right[n].owner=leader;left[n].owner=mate;r.teams[t].shields.push(right[n],left[n])}
  const base=card('EXベース','ベース','EXBP-001','HP 3／トークン');base.token=true;base.owner=leader;r.teams[t].base=[base];
  if(t!==r.first)for(const j of members(r,t)){const ex=card('EXリソース','リソース','EXR-001');ex.token=true;r.players[j].resources.push(ex)}
 }
}
export function handleShared(r,i,a){
 if(a.type==='teamShield'){
  const t=r.teams[teamOf(i)],c=t.shields[0];check(c&&c.id===a.id,'一番上のシールドが更新されました。選び直してください。');
  check(['resolving','hand','trash'].includes(a.to),'シールドの移動先が不正です。');check(!r.players[c.owner].peek||a.to!=='hand','持ち主の山札確認が終わるまで待ってください。');
  t.shields.shift();const owner=c.owner;if(a.to==='hand')c.id=uid();reset(c);r.players[owner][a.to].push(c);
  say(r,i,`共有シールドを${r.players[owner].name}の${{resolving:'効果処理中（公開）',hand:'手札',trash:'トラッシュ'}[a.to]}へ`);return true;
 }
 if(a.type==='teamBase'){
  const t=r.teams[teamOf(i)],c=t.base.find(c=>c.id===a.id);check(c,'自分のチームの共有ベースを選んでください。');
  if(a.operation==='rest')c.rest=!c.rest;
  else if(a.operation==='damage'){check([1,-1].includes(a.delta),'ダメージ指定が不正です。');c.damage=Math.min(99,Math.max(0,c.damage+a.delta))}
  else if(a.operation==='modifier'){
   check([a.ap,a.hp].every(n=>Number.isInteger(n)&&Math.abs(n)<=99)&&typeof a.note==='string'&&a.note.length<=140&&['turn','manual'].includes(a.duration)&&typeof a.skipRefresh==='boolean','ベースの補正指定が不正です。');c.modifier={ap:a.ap,hp:a.hp,note:a.note,duration:a.duration};c.skipRefresh=a.skipRefresh;
  }else if(a.operation==='move'){
   check(['trash','removed','hand','deck'].includes(a.to)&&(!c.token||a.to==='removed'),'トークンは除外、通常のベースは持ち主の領域へ移動してください。');
   check(!r.players[c.owner].peek||a.to!=='deck','持ち主の山札確認を完了してください。');t.base=[];reset(c);
   if(['hand','deck'].includes(a.to))c.id=uid();if(a.to==='deck'&&a.position!=='bottom')r.players[c.owner].deck.unshift(c);else r.players[c.owner][a.to].push(c);
  }else throw Error('ベースの操作が不正です。');
  say(r,i,'共有ベースの'+({rest:'向き',damage:'ダメージ',modifier:'補正',move:'配置場所'}[a.operation])+'を変更');return true;
 }
 return false;
}
const vanilla=['GD01-008','GD05-015','GD01-035','GD01-060','GD01-085','GD02-013','GD02-080','GD03-032','GD03-063','GD04-078','GD05-014','GD05-027','GD05-042','GD05-062','GD05-077','ST01-005','ST04-008','ST05-004','ST05-009','ST06-004','ST09-005','ST10-005','ST11-008','ST12-010'];
export function teamDeckIssues(r,catalog){
 if(!isTeam(r))return [];
 const issues=[];
 for(let t=0;t<2;t++){
  const ids=members(r,t),ps=ids.map(j=>r.players[j]);if(ps.length!==2||!ps.every(p=>p.deckLoaded))continue;
  const label=`チーム${t===0?'A':'B'}：`,decks=ps.map(p=>[...p.registeredDeck,...p.sideboard]);
  const colors=decks.map(cs=>new Set(cs.flatMap(c=>(catalog.get(c.number)?.color||'').split(/[ /,]+/)).filter(x=>x&&!['-','無色','Colorless'].includes(x))));
  if([...colors[0]].some(c=>colors[1].has(c)))issues.push(label+'味方同士でデッキの色が重複しています。');
  const cards=decks.flat(),counts=new Map();for(const c of cards)counts.set(c.number,(counts.get(c.number)||0)+1);
  if(counts.has('GD01-020'))issues.push(label+'禁止カード「GD01-020 アンクシャ」が含まれています。');
  if((counts.get('ST02-016')||0)>2)issues.push(label+'制限カード「ST02-016 コルシカ基地」はチーム合計2枚までです。');
  if(counts.has('ST01-010')&&counts.has('ST05-010'))issues.push(label+'アムロ・レイと三日月・オーガスは禁止ペアです。');
  const used=vanilla.filter(n=>counts.has(n));if(used.length>1)issues.push(label+'対象のLv.2／COST1／AP2／HP2の効果なしユニットはチームで1種類までです。');
  if(used.some(n=>counts.get(n)>4))issues.push(label+'対象の効果なしユニットはチーム合計4枚までです。');
  if(cards.some(c=>!catalog.has(c.number)))issues.push(label+'未収録のカード番号があります。');
 }
 return issues;
}
