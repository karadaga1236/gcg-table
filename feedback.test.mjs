import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {room,join,act,view} from './engine.mjs';
import {linked,deployment} from './public/unit-state.js';
import {cardStats} from './public/card-stats.js';
import {cardTags,abilityTags} from './public/card-tags.js';
const deck=readFileSync(new URL('./public/sample-deck.txt',import.meta.url),'utf8');
const catalog=JSON.parse(readFileSync(new URL('./public/catalog.json',import.meta.url))).cards;
function setup(bestOf=1){const r=room('A',bestOf);join(r,'B');const run=(i,type,a={})=>act(r,i,{type,revision:r.revision,...a});for(let i=0;i<2;i++)run(i,'load',{deck});r.dice={rolls:[6,1],winner:0,round:1};run(0,'chooseFirst',{first:0});run(0,'start');run(0,'keep');run(1,'keep');return {r,run}}
function unit(r,run,number='ST01-001'){const p=r.players[0],from=['hand','deck','shields'].find(z=>p[z].some(c=>c.number===number)),c=p[from].find(c=>c.number===number);run(0,'move',{from,id:c.id,to:'battle'});return c}
test('デュナメスとロックオン（ニール）、連名・複数候補・混合条件を含有一致でリンクする',()=>{
 const u={...catalog.find(c=>c.number==='ST07-005'),id:'unit',deployedTurn:1},p={...catalog.find(c=>c.number==='ST07-011'),attachedTo:'unit'};
 assert.equal(linked(u,[u,p]),true);assert.equal(deployment(u,[u,p],1),'LINK');assert.equal(linked(u,[u,{...p,name:'アムロ・レイ'}]),false);
 assert.equal(linked({...u,link:'「ガロード・ラン」'},[u,{...p,name:'ガロード・ラン＆ティファ・アディール'}]),true);
 assert.equal(linked({...u,link:'「刹那・F・セイエイ」 「ロックオン・ストラトス」'},[u,p]),true);
 assert.equal(linked({...u,link:'特徴〔ニュータイプ〕 特徴〔CB〕'},[u,p]),true);
 assert.equal(linked({...u,link:'特徴〔ジオン〕 「ロックオン・ストラトス」'},[u,p]),true);
 assert.equal(linked({...u,link:'「ロックオン・ストラトス」以外'},[u,p]),false);
});
test('別名としても扱うパイロットは元の名前・別名の両方でリンクし、無関係な効果名は使わない',()=>{
 for(const [number,alias] of [['ST12-012','マリーダ・クルス'],['GD02-098','シャア・アズナブル'],['ST12-011','ゼクス・マーキス']]){
  const pilot={...catalog.find(c=>c.number===number),attachedTo:'unit'};
  const printed=catalog.find(c=>c.type==='ユニット'&&c.link==='「'+alias+'」');
  assert.ok(printed,alias);
  const u={...printed,id:'unit',deployedTurn:1};
  assert.equal(linked(u,[u,pilot]),true,number);assert.equal(deployment(u,[u,pilot],1),'LINK');
  assert.equal(linked({...u,link:'「'+pilot.name+'」'},[u,pilot]),true);
  assert.equal(linked({...u,link:'「アムロ・レイ」'},[u,pilot]),false);
  assert.equal(linked(u,[u,{...pilot,effect:'【リンク時】「'+alias+'」を手札に加える。'}]),false);
  assert.equal(linked(u,[u,{...pilot,effect:'【リンク中】このカードのカード名は「'+alias+'」としても扱う。'}]),false);
 }
});
test('両者が同じデッキで再戦すると部屋・席・構成を保ち、得点と盤面を初期化する',()=>{
 const {r,run}=setup(),code=r.code,tokens=r.players.map(p=>p.token),lists=r.players.map(p=>p.registeredDeck.map(c=>c.number));run(0,'concede');run(0,'rematch',{choice:'same'});assert.equal(r.stage,'ended');run(1,'rematch',{choice:'same'});assert.equal(r.stage,'lobby');assert.equal(r.code,code);assert.deepEqual(r.players.map(p=>p.token),tokens);assert.deepEqual(r.score,[0,0]);assert.equal(r.matchWinner,null);assert.equal(r.firstSelected,null);assert.deepEqual(r.dice.rolls,[null,null]);assert.ok(r.players.every(p=>p.deckLoaded&&p.battle.length===0&&p.hand.length===0));assert.deepEqual(r.players.map(p=>p.registeredDeck.map(c=>c.number)),lists);
 r.dice={rolls:[1,6],winner:1,round:1};run(1,'chooseFirst',{first:1});run(0,'start');run(1,'keep');run(0,'keep');assert.equal(r.stage,'play');assert.equal(r.players[1].hand.length,6);
});
test('片方が選び直して再戦する場合は新デッキ登録を待ち、BO3ゲーム間とは区別する',()=>{
 const {r,run}=setup();run(0,'concede');run(0,'rematch',{choice:'change'});run(1,'rematch',{choice:'same'});assert.equal(r.players[0].deckLoaded,false);assert.equal(r.players[1].deckLoaded,true);run(0,'load',{deck});assert.ok(r.players.every(p=>p.deckLoaded));assert.throws(()=>run(0,'rematch',{choice:'same'}));
 const three=setup(3);three.run(0,'concede');assert.equal(three.r.matchWinner,null);assert.throws(()=>three.run(0,'rematch',{choice:'same'}));three.run(0,'nextGame');assert.equal(three.r.stage,'sideboard');
});
test('トークン35種の画像・AP・HPを検証し、選択配備を相手に同期する',()=>{
 const list=JSON.parse(readFileSync(new URL('./public/tokens.json',import.meta.url))).cards;assert.equal(list.length,35);for(const c of list){assert.match(c.number,/^T-\d{3}$/);assert.match(c.ap,/^(\d+|-)$/);assert.match(c.hp,/^(\d+|-)$/);assert.equal(readFileSync(new URL('./public/cards/'+c.number+'.webp',import.meta.url)).toString('ascii',8,12),'WEBP')}
 const {r,run}=setup();run(0,'createToken',{number:'T-008',count:2,rest:true});const cards=r.players[0].battle;assert.equal(cards.length,2);assert.ok(cards.every(c=>c.token&&c.rest&&c.level===0&&c.ap===3&&c.hp===3));assert.ok(cardTags(cards[0]).abilities.includes('ブロッカー'));assert.deepEqual(view(r,1).players[0].battle,cards);const before=structuredClone(r);assert.throws(()=>run(0,'createToken',{number:'ST01-001',count:1,rest:false}));assert.deepEqual(r,before);
});
test('一括補正を既存補正に加算し、期限の異なる効果を独立して解除する',()=>{
 const {r,run}=setup(),a=unit(r,run),b=unit(r,run,'ST01-003');run(0,'modifier',{from:'battle',id:a.id,ap:2,hp:0,note:'継続',duration:'manual',skipRefresh:false});run(0,'bulkModifier',{ids:[a.id,b.id],ap:1,hp:0,note:'全体AP+1',duration:'turn'});run(0,'bulkModifier',{ids:[a.id,b.id],ap:0,hp:2,note:'継続HP+2',duration:'manual'});assert.equal(cardStats(a).ap,6);assert.equal(cardStats(b).ap,3);assert.equal(cardStats(a).hp,6);assert.equal(cardStats(view(r,1).players[0].battle[0]).ap,6);
 run(0,'phase');run(0,'phase');assert.equal(cardStats(a).ap,5);assert.equal(cardStats(b).ap,2);assert.equal(cardStats(a).hp,6);run(0,'clearBulkModifier',{id:a.effects[0].id});assert.equal(cardStats(a).hp,4);assert.equal(cardStats(b).hp,4);
});
test('一括補正の対象に相手・パイロット・不正IDがあれば全件拒否し、移動時に解除する',()=>{
 const {r,run}=setup(),a=unit(r,run),before=structuredClone(r);assert.throws(()=>run(0,'bulkModifier',{ids:[a.id,'wrong'],ap:1,hp:0,note:'',duration:'turn'}));assert.deepEqual(r,before);assert.throws(()=>run(1,'bulkModifier',{ids:[a.id],ap:1,hp:0,note:'',duration:'turn'}));run(0,'bulkModifier',{ids:[a.id],ap:1,hp:0,note:'',duration:'turn'});run(0,'move',{from:'battle',id:a.id,to:'hand'});assert.equal(a.effects,undefined);
});
test('Lv・印刷能力をタグにし、条件付き能力と単なる効果内の言及を区別する',()=>{
 assert.deepEqual(abilityTags({effect:'《ブロッカー》(説明)\n《リペア2》(説明)'}),['ブロッカー','リペア2']);assert.deepEqual(abilityTags({effect:'【リンク中】《ブロッカー》を得る。'}),['条件：ブロッカー']);assert.deepEqual(abilityTags({effect:'相手の《ブロッカー》を持つユニットを選ぶ。'}),[]);
 assert.deepEqual(abilityTags({effect:'《ブロッカー》を持つ味方がいる間、これは《制圧》を得る。'}),['条件：制圧']);const {r,run}=setup(),c=unit(r,run);assert.equal(cardTags(c).level,4);assert.ok(cardTags(c).abilities.includes('リペア2'));assert.equal(cardTags({token:true}).level,0);
});
