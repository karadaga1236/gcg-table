import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdir, mkdtemp, rm} from 'node:fs/promises';
import path from 'node:path';
import {room,join,act,view,zones} from './engine.mjs';
import {library,deckText,textDeck,validateDeckParts} from './public/deck-store.js';
import {diskLibrary} from './disk-library.mjs';
const catalog=JSON.parse(await readFile(new URL('./public/catalog.json',import.meta.url))).cards;
const mainText=await readFile(new URL('./public/sample-deck.txt',import.meta.url),'utf8');
const main=textDeck(mainText,catalog), colors=new Set(main.map(c=>c.color));
const side=catalog.filter(c=>colors.has(c.color)&&!main.some(m=>m.number===c.number)).slice(0,3).map((c,i)=>({...c,count:i===2?2:4}));
const sideText=deckText(side);
function memory(){const m=new Map();return {get length(){return m.size},key:i=>[...m.keys()][i],getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)}}
function setup(bestOf=3){const r=room('ホスト',bestOf);join(r,'ゲスト');const run=(i,type,a={})=>act(r,i,{type,revision:r.revision,...a});for(let i=0;i<2;i++)run(i,'load',{deck:mainText,sideboard:sideText});r.dice={rolls:[6,1],winner:0,round:1};return {r,run}}
function start(r,run,first=0){run(0,'chooseFirst',{first});run(0,'start');run(first,'keep');run(1-first,'keep')}
function next(r,run,first){run(0,'nextGame');run(r.lastLoser,'chooseFirst',{first});run(0,'sideReady',{ready:true});run(1,'sideReady',{ready:true});run(0,'startNext');run(first,'keep');run(1-first,'keep')}

test('BO1でもダイス勝者が後攻を選択でき、先攻は両者確定後に1枚だけドロー',()=>{
 const {r,run}=setup(1);assert.throws(()=>run(0,'start'),/選んで/);assert.throws(()=>run(1,'chooseFirst',{first:1}),/決定権/);run(0,'chooseFirst',{first:1});run(0,'start');assert.equal(r.players[1].hand.length,5);assert.throws(()=>run(0,'keep'),/先攻/);run(1,'keep');assert.equal(r.players[1].hand.length,5);run(0,'keep');assert.equal(r.turn,1);assert.equal(r.players[1].hand.length,6);assert.equal(r.players[0].hand.length,5);assert.equal(r.players[1].resources.length,1);assert.equal(r.players[0].resources.length,1);for(let i=0;i<3;i++)view(r,1);assert.equal(r.players[1].hand.length,6);run(0,'concede');assert.equal(r.matchWinner,1);assert.deepEqual(r.score,[0,1]);assert.throws(()=>run(1,'concede'));assert.throws(()=>run(0,'nextGame'));
});

test('BO3は直前の敗者が先後を選択し、2勝した時点で終了する',()=>{
 const {r,run}=setup();start(r,run);run(1,'concede');assert.deepEqual(r.score,[1,0]);assert.equal(r.matchWinner,null);assert.throws(()=>run(1,'nextGame'));run(0,'nextGame');assert.throws(()=>run(0,'chooseFirst',{first:0}),/決定権/);assert.throws(()=>run(1,'dice'));run(0,'sideReady',{ready:true});assert.throws(()=>run(0,'startNext'));run(1,'sideReady',{ready:true});assert.throws(()=>run(0,'startNext'),/選んで/);run(1,'chooseFirst',{first:0});assert.throws(()=>run(1,'startNext'));run(0,'startNext');run(0,'keep');run(1,'keep');run(0,'concede');assert.deepEqual(r.score,[1,1]);next(r,run,1);assert.equal(r.game,3);assert.equal(r.turn,1);run(0,'concede');assert.deepEqual(r.score,[1,2]);assert.equal(r.matchWinner,1);assert.throws(()=>run(0,'nextGame'));assert.throws(()=>run(0,'concede'));
 const b=setup();start(b.r,b.run);b.run(1,'concede');next(b.r,b.run,1);b.run(1,'concede');assert.equal(b.r.matchWinner,0);assert.equal(b.r.game,2);
});

test('サイド入替は登録したプール内のみ、確定時は50/10枚を守り、相手には内容を返さない',()=>{
 const {r,run}=setup();start(r,run);run(1,'concede');run(0,'nextGame');const pool=()=>[...r.players[0].registeredDeck,...r.players[0].sideboard].map(c=>c.number).sort();const before=pool(),revision=r.revision;
 assert.throws(()=>run(0,'sideSwap',{from:'side',number:'UNKNOWN'}));assert.equal(r.revision,revision);run(0,'sideSwap',{from:'side',number:side[0].number});assert.throws(()=>run(0,'sideReady',{ready:true}),/50枚/);run(0,'sideSwap',{from:'main',number:main[0].number});assert.deepEqual(pool(),before);run(0,'sideReady',{ready:true});assert.throws(()=>run(0,'sideSwap',{from:'main',number:main[1].number}));run(0,'sideReady',{ready:false});assert.equal(r.players[0].sideReady,false);
 const publicState=view(r,1);assert.equal(publicState.players[0].sideboard,10);assert.equal(publicState.players[0].registeredDeck,50);assert.equal(typeof publicState.players[0].hand,'number');assert.ok(!JSON.stringify(publicState).includes(r.players[0].token));assert.ok(!JSON.stringify(publicState.log).includes(side[0].number));assert.ok(Array.isArray(view(r,0).players[0].sideboard));
});

test('次ゲームは入替後の構成で配り直し、盤面・ダメージ・引き直しをリセットする',()=>{
 const {r,run}=setup();start(r,run);const p=r.players[0],identity=p.token,firstIDs=p.hand.map(c=>c.id);run(0,'move',{from:'hand',id:p.hand[0].id,to:'battle'});run(0,'rest',{from:'battle',id:p.battle[0].id});run(0,'damage',{from:'battle',id:p.battle[0].id,delta:1});run(0,'stepMode',{enabled:true});run(1,'concede');run(0,'nextGame');run(0,'sideSwap',{from:'side',number:side[0].number});run(0,'sideSwap',{from:'main',number:main[0].number});run(1,'chooseFirst',{first:0});for(let i=0;i<2;i++)run(i,'sideReady',{ready:true});run(0,'startNext');assert.equal(p.token,identity);assert.equal(p.hand.length,5);assert.equal(p.deck.length,45);assert.equal(p.resourceDeck.length,10);assert.equal(p.ready,false);assert.equal(p.mulligan,false);assert.equal(p.stepMode,true);for(const z of zones.filter(z=>!['hand','deck','resourceDeck'].includes(z)))assert.equal(p[z].length,0,z);assert.ok(p.hand.every(c=>!firstIDs.includes(c.id)&&!c.rest&&!c.damage));assert.equal([...p.deck,...p.hand].filter(c=>c.number===side[0].number).length,1);run(0,'keep');run(1,'keep');assert.equal(p.hand.length,5);run(0,'phase');assert.equal(p.hand.length,6);view(r,0);assert.equal(p.hand.length,6);assert.deepEqual(r.score,[1,0]);
});

test('不正なサイド枚数・合算5枚・3色の登録を原子化して拒否し、旧デッキも使える',()=>{
 const {r,run}=setup();const prior=structuredClone(r.players[0]),revision=r.revision;for(const invalid of [deckText(side.slice(0,1)),deckText([{...main[0],count:4},...side.slice(1)]),deckText(side.map((c,i)=>i?c:{...catalog.find(c=>!colors.has(c.color)),count:4}))]){assert.throws(()=>run(0,'load',{deck:mainText,sideboard:invalid}));assert.deepEqual(r.players[0],prior);assert.equal(r.revision,revision)}run(0,'load',{deck:mainText});assert.equal(r.players[0].sideboard.length,0);assert.throws(()=>room('A',2));
});

test('サイドを含むデッキ控えv2と旧v1を読み込み、合算4枚の上限を保存時にも守る',()=>{
 const lib=library(memory()),p=lib.createProfile('A');lib.save(p.id,{name:'サイドあり',cards:main,sideboard:side});const data=lib.exportProfile(p.id);assert.equal(data.version,2);const imported=lib.importProfile(data);assert.deepEqual(lib.decks(imported.id)[0].sideboard,lib.decks(p.id)[0].sideboard);const legacy=lib.importProfile({format:'gcg-table-decks',version:1,player:'旧版',decks:[{name:'旧',cards:main}]});assert.deepEqual(lib.decks(legacy.id)[0].sideboard,[]);assert.throws(()=>validateDeckParts(main,[{...main[0],count:4}]));assert.throws(()=>validateDeckParts(main,[...side,{...side[0],number:'GD99-999',count:1}]));const count=lib.profiles().length;data.decks[0].sideboard=[{...main[0],count:4}];assert.throws(()=>lib.importProfile(data));assert.equal(lib.profiles().length,count);
});

test('サイドボードはプレイヤーのローカルファイルに保存され、再起動・上書き前の控えにも残る',async t=>{
 const root=path.resolve('work');await mkdir(root,{recursive:true});const dir=await mkdtemp(path.join(root,'gcg-match-test-'));t.after(async()=>{assert.ok(path.resolve(dir).startsWith(root+path.sep+'gcg-match-test-'));await rm(dir,{recursive:true,force:true})});const a=diskLibrary(dir),p=(await a.change('createProfile',{name:'保存テスト'})).result,d=(await a.change('save',{profile:p.id,deck:{name:'初版',cards:main,sideboard:side}})).result;await a.change('save',{profile:p.id,deck:{...d,name:'更新版'}});const snap=await diskLibrary(dir).snapshot();assert.equal(snap.decks[0].sideboard.reduce((n,c)=>n+c.count,0),10);assert.equal(JSON.parse(await readFile(path.join(dir,p.id+'.json.bak'))).decks[0].name,'初版');assert.equal(JSON.parse(await readFile(path.join(dir,p.id+'.json.bak'))).decks[0].sideboard.reduce((n,c)=>n+c.count,0),10);
});

test('コマンドは公開の処理領域を経てトラッシュへ移り、相手は操作できない',()=>{
 const {r,run}=setup();start(r,run);const p=r.players[0],command=p.deck.find(c=>c.type==='コマンド');assert.ok(command);run(0,'move',{from:'deck',id:command.id,to:'hand'});const id=command.id,remaining=p.hand.length,resourceRest=p.resources.map(c=>c.rest);assert.equal(typeof view(r,1).players[0].hand,'number');run(0,'move',{from:'hand',id,to:'resolving'});assert.equal(p.hand.length,remaining-1);assert.equal(p.battle.length,0);assert.equal(view(r,1).players[0].resolving[0].number,command.number);assert.equal(view(r,1).players[0].resolving[0].name,command.name);assert.throws(()=>run(1,'move',{from:'resolving',id,to:'trash'}));assert.deepEqual(p.resources.map(c=>c.rest),resourceRest);run(0,'move',{from:'resolving',id,to:'trash'});assert.equal(view(r,1).players[0].resolving.length,0);assert.equal(view(r,1).players[0].trash.at(-1).number,command.number);assert.throws(()=>run(0,'move',{from:'resolving',id,to:'trash'}));assert.equal(p.trash.length,1);
});
