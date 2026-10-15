import { randomBytes, randomInt } from 'node:crypto';
export const zones=['hand','battle','base','shields','trash','removed','resolving','resources','deck','resourceDeck'];
export const labels={hand:'手札',battle:'バトル',base:'ベース',shields:'シールド',trash:'トラッシュ',removed:'除外',resolving:'効果処理中',resources:'リソース',deck:'山札',resourceDeck:'リソースデッキ'};
const id=()=>randomBytes(18).toString('hex');
const check=(ok,message)=>{if(!ok)throw Error(message)};
const card=(name,type='ユニット',number='',note='')=>({id:id(),name,type,number,note,rest:false,damage:0,attachedTo:null});
function shuffle(a){for(let i=a.length-1;i>0;i--){let j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]]}a.forEach(c=>c.id=id())}
export function parseDeck(text){
 check(typeof text==='string'&&text.length<=20000,'デッキ入力が長すぎます。');
 const result=[],counts={};
 for(const line of text.split(/\r?\n/).filter(s=>s.trim())){
  const [n,num,name,type='ユニット',note='']=line.split('|').map(s=>s.trim());
  check(/^\d+$/.test(n)&&Number(n)>=1&&Number(n)<=4&&num&&name,'各行を「枚数 | カードNo. | カード名 | 種類 | メモ」で入力してください。枚数は1〜4です。');
  check(num.length<=40&&name.length<=80&&note.length<=500,'カードの入力が長すぎます。');
  check(['ユニット','パイロット','コマンド','ベース'].includes(type),'種類はユニット・パイロット・コマンド・ベースから選んでください。');
  const key=num.toUpperCase();counts[key]=(counts[key]||0)+Number(n);check(counts[key]<=4,'同じカードNo.は4枚までです。');
  for(let i=0;i<Number(n);i++)result.push(card(name,type,num,note));
 }
 check(result.length===50,'デッキは合計50枚で登録してください。');return result;
}
export function player(name){check(typeof name==='string'&&name.trim().length>=1&&name.length<=24,'名前を1〜24文字で入力してください。');return {name:name.trim(),token:id(),ready:false,mulligan:false,deckLoaded:false,stepMode:false,...Object.fromEntries(zones.map(z=>[z,[]]))}}
export function room(name){return {code:randomBytes(6).toString('hex').toUpperCase(),players:[player(name)],stage:'lobby',dice:{rolls:[null,null],winner:null,round:1},first:0,turn:0,round:1,phase:0,revision:0,log:[],updated:Date.now()}}
function log(r,text){r.log.unshift(text);r.log=r.log.slice(0,100)}
function draw(r,i){const p=r.players[i];if(p.deck.length){p.hand.push(p.deck.shift());log(r,`${p.name}：1枚ドロー`)}if(!p.deck.length){r.stage='ended';r.winner=1-i;log(r,`${p.name}：山札が0枚になったため敗北`)}}
function resource(r,i){const p=r.players[i];if(p.resourceDeck.length){const c=p.resourceDeck.shift();c.rest=false;p.resources.push(c);log(r,`${p.name}：リソースを1枚アクティブで配置`)}else log(r,`${p.name}：リソースデッキが空のため追加なし`)}
function nextPhase(r){r.phase++;if(r.phase===1)draw(r,r.turn);if(r.phase===2)resource(r,r.turn)}
function beginTurn(r){const p=r.players[r.turn];r.phase=0;for(const z of ['battle','base','resources'])p[z].forEach(c=>c.rest=false);log(r,`${p.name}：ターン開始・場をアクティブに`);if(!p.stepMode){while(r.phase<3&&r.stage==='play')nextPhase(r)}else log(r,'開始時の効果を処理してから次へ進んでください')}
export function join(r,name){check(r.players.length===1,'このルームは満員です。');check(r.stage==='lobby','この対戦は開始済みです。');r.players.push(player(name));log(r,'対戦相手が参加しました。');r.revision++}
export function seat(r,token){let i=r.players.findIndex(p=>p.token===token);check(i!==-1,'参加情報が無効です。ルームに入り直してください。');return i}
export function view(r,i){return {code:r.code,stage:r.stage,dice:structuredClone(r.dice),winner:r.winner,first:r.first,turn:r.turn,round:r.round,phase:r.phase,revision:r.revision,me:i,log:r.log,players:r.players.map((p,j)=>({name:p.name,ready:p.ready,mulligan:p.mulligan,deckLoaded:p.deckLoaded,stepMode:p.stepMode,...Object.fromEntries(zones.map(z=>[z,z==='deck'||z==='resourceDeck'||(z==='hand'&&j!==i)?p[z].length:p[z].map(c=>z==='shields'?{id:c.id,hidden:true}:structuredClone(c))]))}))}}
export function act(r,i,a){
 check(a&&typeof a.type==='string','操作が不正です。');check(a.revision===r.revision,'盤面が更新されました。内容を確認してもう一度操作してください。');
 const p=r.players[i];const say=t=>log(r,`${p.name}：${t}`);
 if(a.type==='load'){
  check(r.stage==='lobby','開始後はデッキを変更できません。');const d=parseDeck(a.deck);p.deck=d;p.deckLoaded=true;say('デッキ50枚を登録');
 }else if(a.type==='dice'){
  check(r.stage==='lobby'&&r.players.length===2,'2人が入室してからダイスを振ってください。');check(r.dice.winner===null,'先攻は決定済みです。');
  if(r.dice.rolls.every(n=>n!==null)){r.dice.rolls=[null,null];r.dice.round++}
  check(r.dice.rolls[i]===null,'相手のダイスを待ってください。');r.dice.rolls[i]=randomInt(1,7);say(`ダイス ${r.dice.rolls[i]}`);
  if(r.dice.rolls.every(n=>n!==null)){const [a,b]=r.dice.rolls;if(a===b)log(r,'ダイスは同点。2人とも振り直してください。');else{r.dice.winner=a>b?0:1;r.first=r.dice.winner;log(r,`${r.players[r.first].name}が先攻に決定`)}}
 }else if(a.type==='stepMode'){
  check(r.stage!=='ended'&&typeof a.enabled==='boolean','設定が不正です。');p.stepMode=a.enabled;say(a.enabled?'開始処理をフェイズごとに確認':'開始処理をメインまで自動実行');
 }else if(a.type==='start'){
  check(i===0&&r.stage==='lobby','ルーム作成者だけが開始できます。');check(r.players.length===2&&r.players.every(x=>x.deckLoaded),'2人ともデッキを登録してください。');check(r.dice.winner!==null,'ダイスで先攻を決めてください。');
  r.first=r.dice.winner;r.turn=r.first;r.stage='prepare';for(const q of r.players){shuffle(q.deck);q.hand=q.deck.splice(0,5);q.resourceDeck=Array.from({length:10},()=>card('リソース','リソース','R-001'));}say('初手5枚を配布。先攻から手札を確定してください');
 }else if(a.type==='keep'||a.type==='mulligan'){
  check(r.stage==='prepare'&&!p.ready,'手札確定は準備中に1回です。');check(i===r.first||r.players[r.first].ready,'先攻の手札確定を待ってください。');
  if(a.type==='mulligan'){p.deck.push(...p.hand);p.hand=p.deck.splice(0,5);shuffle(p.deck);p.mulligan=true;}p.ready=true;say(a.type==='keep'?'手札を確定':'手札を引き直して確定');
  if(r.players.every(q=>q.ready)){for(const [j,q] of r.players.entries()){q.shields=q.deck.splice(0,6);q.base=[card('EXベース','ベース','EXBP-001','HP 3／トークン')];q.base[0].token=true;if(j!==r.first){const c=card('EXリソース','リソース','EXR-001');c.token=true;q.resources.push(c)}}r.stage='play';log(r,'対戦開始。基本の開始処理は自動、カード効果・支払い・戦闘は手動です。');beginTurn(r)}
 }else{
  check(r.stage==='play','対戦開始後に操作できます。');
  if(a.type==='draw'){draw(r,i);}
  else if(a.type==='resource'){check(p.resourceDeck.length,'リソースデッキが空です。');resource(r,i);}
  else if(a.type==='shuffle'){shuffle(p.deck);say('山札をシャッフル');}
  else if(a.type==='refresh'){for(const z of ['battle','base','resources'])p[z].forEach(c=>c.rest=false);say('自分の場をすべてアクティブに');}
  else if(a.type==='phase'){check(r.turn===i,'ターン中のプレイヤーが進行してください。');if(r.phase===4){check(p.hand.length<=10,'手札が10枚になるまでトラッシュへ捨ててください。');r.turn=1-r.turn;r.round++;beginTurn(r)}else{nextPhase(r);if(r.phase===4)say('エンドフェイズ。終了時の効果と手札上限10枚を確認してください。')}}
  else if(a.type==='token'){check(typeof a.name==='string'&&a.name.trim()&&a.name.length<=80,'トークン名を入力してください。');check(['battle','base','resources'].includes(a.to),'配置先が不正です。');check(p[a.to].length<30,'この領域のカード数が多すぎます。');let c=card(a.name,a.to==='resources'?'リソース':a.to==='base'?'ベース':'ユニット');c.token=true;c.number=c.name==='EXリソース'?'EXR-001':c.name==='EXベース'?'EXBP-001':'';p[a.to].push(c);say(`${c.name}を配置`);}
  else if(a.type==='concede'){r.stage='ended';say('投了しました');}
  else if(a.type==='search'){say('効果のため山札の内容を確認（順序は表示しません）');}
  else{
   check(zones.includes(a.from),'領域が不正です。');let idx=p[a.from].findIndex(c=>c.id===a.id);check(idx>=0,'自分のカードを選んでください。');let c=p[a.from][idx];
   if(a.type==='move'){
    check(zones.includes(a.to)&&a.to!==a.from,'移動先を選んでください。');check(p[a.to].length<100,'移動先がいっぱいです。');
    check(!c.token||['battle','base','resources','removed'].includes(a.to),'トークンは場か除外へ移動してください。');
    const hidden=['hand','deck','shields','resourceDeck'].includes(a.from);const destHidden=['hand','deck','shields','resourceDeck'].includes(a.to);
    // Cards leaving a unit become separate; attached pilots go to trash when the unit leaves battle.
    if(a.from==='battle'&&a.to!=='battle'){let pilots=p.battle.filter(x=>x.attachedTo===c.id);p.battle=p.battle.filter(x=>x.attachedTo!==c.id);for(const x of pilots){x.attachedTo=null;x.rest=false;x.damage=0;p.trash.push(x)}idx=p.battle.findIndex(x=>x.id===c.id)}
    p[a.from].splice(idx,1);c.attachedTo=null;c.rest=false;c.damage=0;
    if(destHidden)c.id=id();if(a.to==='deck'&&a.position!=='bottom')p.deck.unshift(c);else p[a.to].push(c);
    say(`${hidden&&destHidden?'カード1枚':c.name}：${labels[a.from]} → ${labels[a.to]}`);
   }else if(a.type==='rest'||a.type==='damage'){
    check(['battle','base','resources'].includes(a.from),'場のカードを選んでください。');
    if(a.type==='rest'){c.rest=!c.rest;say(`${c.name}を${c.rest?'レスト':'アクティブ'}に`)}else{check(a.delta===1||a.delta===-1,'ダメージ指定が不正です。');c.damage=Math.max(0,Math.min(99,c.damage+a.delta));say(`${c.name}のダメージ：${c.damage}`)}
   }else if(a.type==='attach'){
    check(['hand','battle','resolving'].includes(a.from)&&['パイロット','コマンド'].includes(c.type),'パイロットまたはコマンドを選んでください。');const target=p.battle.find(x=>x.id===a.target&&x.type==='ユニット');check(target&&!p.battle.some(x=>x.attachedTo===target.id),'セット先はパイロット未セットのユニットを選んでください。');p[a.from].splice(idx,1);c.attachedTo=target.id;p.battle.push(c);say(`${c.name}を${target.name}にセット`);
   }else throw Error('未対応の操作です。');
  }
 }
 r.revision++;r.updated=Date.now();return view(r,i);
}
