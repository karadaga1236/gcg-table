import test from 'node:test';
import assert from 'node:assert/strict';
import {room,join,act,view,parseDeck} from './engine.mjs';
import {createServer} from './server.mjs';
import {getCardImage,validNumber} from './card-images.mjs';
import {readFile} from 'node:fs/promises';
const deck=Array.from({length:13},(_,i)=>`${i===12?2:4} | TEST-${i} | Secret card ${i} | ${i<8?'ユニット':'パイロット'}`).join('\n');
function ready(){const r=room('Alice');join(r,'Bob');const run=(i,type,a={})=>act(r,i,{type,revision:r.revision,...a});run(0,'load',{deck});run(1,'load',{deck});r.dice={rolls:[6,1],winner:0,round:1};run(0,'chooseFirst',{first:0});run(0,'start');return {r,run}}
test('実カード16種のローカル画像と50枚サンプルを読み込める',async()=>{
 const catalog=JSON.parse(await readFile(new URL('./public/catalog.json',import.meta.url),'utf8'));assert.ok(catalog.cards.length>=16);
 for(const c of catalog.cards.filter(c=>c.number.startsWith('ST01-'))){assert.ok(validNumber(c.number));const bytes=await getCardImage(c.number,new URL('./public/cards/',import.meta.url));assert.equal(bytes.toString('ascii',8,12),'WEBP')}
 assert.equal(parseDeck(await readFile(new URL('./public/sample-deck.txt',import.meta.url),'utf8')).length,50);
 assert.equal(validNumber('../server'),false);assert.equal(validNumber('https://example.com'),false);
 await assert.rejects(()=>getCardImage('../server',new URL('./public/cards/',import.meta.url)));
});
test('差分確認は認証後のみ・更新がなければ本文を再送しない',async()=>{
 const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const base='http://127.0.0.1:'+server.address().port;
  const created=await (await fetch(base+'/api/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Tester'})})).json();
  const {code,revision}=created.state;const headers={Authorization:'Bearer '+created.token};
  const unchanged=await fetch(`${base}/api/state?code=${code}&since=${revision}`,{headers});assert.equal(unchanged.status,204);assert.equal(await unchanged.text(),'');
  const unauthorized=await fetch(`${base}/api/state?code=${code}&since=${revision}`);assert.equal(unauthorized.status,400);
  await fetch(base+'/api/join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,name:'Partner'})});
  const changed=await fetch(`${base}/api/state?code=${code}&since=${revision}`,{headers});assert.equal(changed.status,200);const state=await changed.json();assert.equal(state.players.length,2);assert.ok(state.revision>revision);
  const health=await fetch(base+'/healthz');assert.equal(health.status,200);assert.deepEqual(await health.json(),{ok:true});
  const picture=await fetch(base+'/cards/ST01-001.webp');assert.equal(picture.status,200);assert.equal(picture.headers.get('content-type'),'image/webp');assert.equal(Buffer.from(await picture.arrayBuffer()).toString('ascii',8,12),'WEBP');
  const badPicture=await fetch(base+'/cards/invalid.webp');assert.equal(badPicture.status,404);
  assert.equal((await fetch(base+'/')).headers.get('x-robots-tag'),'noindex, nofollow');
 }finally{await new Promise(resolve=>server.close(resolve))}
});
test('50枚・同番号4枚を検証する',()=>{assert.equal(parseDeck(deck).length,50);assert.throws(()=>parseDeck(deck.replace('TEST-1 |','TEST-0 |')));assert.throws(()=>parseDeck(deck+'\n1 | EXTRA | extra | ユニット'))});
test('初手・引き直し・シールド・後攻EXの準備',()=>{const {r,run}=ready();assert.equal(r.players[0].hand.length,5);assert.throws(()=>run(1,'keep'));const old=r.players[0].hand.map(c=>c.name);run(0,'mulligan');assert.equal(r.players[0].deck.length,45);run(1,'keep');assert.equal(r.stage,'play');for(const [j,p] of r.players.entries()){assert.equal(p.deck.length,j===0?38:39);assert.equal(p.hand.length,j===0?6:5);assert.equal(p.shields.length,6);assert.equal(p.resourceDeck.length,j===0?9:10);assert.equal(p.base[0].name,'EXベース')}assert.equal(r.players[0].resources.length,1);assert.equal(r.players[1].resources.length,1);assert.equal(old.length,5)});
test('秘密情報を相手に送らず、他人のカード操作を拒否する',()=>{const {r,run}=ready();run(0,'keep');run(1,'keep');const v=view(r,0);assert.equal(typeof v.players[1].hand,'number');assert.equal(typeof v.players[0].deck,'number');assert.deepEqual(Object.keys(v.players[0].shields[0]).sort(),['hidden','id']);assert.ok(!JSON.stringify(v).includes(r.players[1].token));assert.throws(()=>run(0,'move',{from:'hand',id:r.players[1].hand[0].id,to:'battle'}));const shield=r.players[0].shields[0];run(0,'move',{from:'shields',id:shield.id,to:'hand'});assert.ok(!r.log[0].includes(shield.name))});
test('操作競合の拒否、ドローの保存、パイロットとダメージ',()=>{const {r,run}=ready();run(0,'keep');run(1,'keep');const revision=r.revision;run(0,'draw');assert.throws(()=>act(r,1,{type:'draw',revision}));const p=r.players[0];let unit=p.deck.find(c=>c.type==='ユニット'),pilot=p.deck.find(c=>c.type==='パイロット');run(0,'move',{from:'deck',id:unit.id,to:'battle'});run(0,'move',{from:'deck',id:pilot.id,to:'hand'});run(0,'attach',{from:'hand',id:pilot.id,target:unit.id});run(0,'damage',{from:'battle',id:unit.id,delta:1});assert.equal(unit.damage,1);run(0,'move',{from:'battle',id:unit.id,to:'trash'});assert.equal(p.battle.length,0);assert.equal(p.trash.length,2);assert.equal(p.trash[0].attachedTo,null);assert.equal(['hand','deck','battle','shields','trash','removed','resolving'].reduce((n,z)=>n+p[z].filter(c=>!c.token).length,0),50)});
test('2クライアントの通信・再接続・認証・3人目の入室拒否',async()=>{const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));try{const base='http://127.0.0.1:'+server.address().port;const post=async(route,body,token)=>{let r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});return {status:r.status,data:await r.json()}};let a=await post('create',{name:'Alice'}),code=a.data.state.code;assert.equal(a.status,200);let b=await post('join',{code,name:'Bob'});assert.equal(b.status,200);assert.equal((await post('join',{code,name:'Eve'})).status,400);assert.equal((await fetch(base+'/api/state?code='+code)).status,400);let get=async t=>(await fetch(base+'/api/state?code='+code,{headers:{Authorization:'Bearer '+t}})).json();let v=await get(a.data.token);assert.equal(v.players.length,2);assert.equal(v.me,0);let load=await post('action',{code,type:'load',deck,revision:v.revision},a.data.token);assert.equal(load.status,200);let vb=await get(b.data.token);assert.equal(vb.players[0].deck,50);assert.equal(vb.players[0].deckLoaded,true);assert.equal(vb.me,1);assert.equal((await fetch(base+'/')).status,200)}finally{await new Promise(resolve=>server.close(resolve))}});
