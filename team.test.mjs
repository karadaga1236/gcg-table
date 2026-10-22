import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {room,join,act,view,seat} from './engine.mjs';
import {teamDeckIssues} from './team.mjs';
import {createServer} from './server.mjs';
import {discoveryService} from './discovery.mjs';
const cards=JSON.parse(readFileSync(new URL('./public/catalog.json',import.meta.url),'utf8')).cards;
const catalog=new Map(cards.map(c=>[c.number,c]));
const excluded=new Set(['GD01-020','ST02-016','ST01-010','ST05-010']);
export function fixtureDeck(color){const pool=cards.filter(c=>c.color===color&&c.effect&&!excluded.has(c.number));const base=pool.find(c=>c.type==='ベース');return [...(base?[base]:[]),...pool.filter(c=>c!==base)].slice(0,13).map((c,n)=>`${n===12?2:4} | ${c.number} | ${c.name} | ${c.type}`).join('\n')}
function setup({bestOf=1,prepare=false}={}){
 const r=room('Aリーダー',bestOf,'team');r.hostToken=r.players[0].token;for(const n of ['Bリーダー','Aメンバー','Bメンバー'])join(r,n);
 const run=(i,type,a={})=>act(r,i,{type,revision:r.revision,...a});
 for(const [i,color] of ['Blue','Red','Green','White'].entries())run(i,'load',{deck:fixtureDeck(color)});
 r.dice={rolls:[6,1],winner:0,round:1};run(0,'chooseFirst',{first:0});run(0,'start');
 if(!prepare)for(const i of [0,2,1,3])run(i,'keep');return {r,run};
}
function cardTo(r,run,i,type,to){const p=r.players[i],from=['hand','deck'].find(z=>p[z].some(c=>c.type===type));assert.ok(from);const id=p[from].find(c=>c.type===type).id;run(i,'move',{from,id,to});return id}
test('4人の定員・チーム分け・先攻後攻と初期配置',()=>{
 const {r}=setup();assert.throws(()=>join(r,'5人目'));assert.equal(r.stage,'play');
 for(const t of r.teams){assert.equal(t.shields.length,8);assert.equal(t.base.length,1);assert.deepEqual(t.shields.map(c=>c.owner%2),Array(8).fill(t.shields[0].owner%2));assert.equal(t.shields.at(-1).owner>=2,true)}
 assert.deepEqual(r.teams[0].shields.map(c=>c.owner),[0,2,0,2,0,2,0,2]);
 assert.deepEqual(r.players.map(p=>p.hand.length),[6,5,6,5]);assert.deepEqual(r.players.map(p=>p.resources.length),[1,1,1,1]);
 assert.deepEqual(r.players.map(p=>p.resources.some(c=>c.number==='EXR-001')),[false,true,false,true]);assert.ok(r.players.every(p=>p.base.length===0&&p.shields.length===0));
});
test('同じチームの引き直しは両者選択まで実行せず、後攻は先攻の確定を待つ',()=>{
 const {r,run}=setup({prepare:true});const original=r.players[0].hand.map(c=>c.id);run(0,'mulligan');assert.deepEqual(r.players[0].hand.map(c=>c.id),original);assert.equal(r.players[0].ready,false);
 assert.throws(()=>run(0,'keep'));assert.throws(()=>run(1,'keep'));run(2,'keep');assert.equal(r.players[0].mulligan,true);assert.ok(r.players[0].ready&&r.players[2].ready);assert.notDeepEqual(r.players[0].hand.map(c=>c.id),original);
 run(3,'mulligan');assert.equal(r.players[3].ready,false);run(1,'keep');assert.equal(r.stage,'play');
});
test('相手チームの手札・山札・シールド内容・認証情報を公開しない',()=>{
 const {r,run}=setup();run(2,'peek',{count:3});
 for(let i=0;i<4;i++){
  const s=view(r,i);for(let j=0;j<4;j++){assert.equal(Array.isArray(s.players[j].hand),i%2===j%2);assert.equal(typeof s.players[j].deck,'number');assert.equal(s.players[j].token,undefined);assert.equal(!!s.players[j].peek?.cards,i===2&&j===2)}
  assert.ok(s.teams.flatMap(t=>t.shields).every(c=>c.hidden&&!c.number&&!c.name));assert.ok(!JSON.stringify(s).includes(r.players[0].token));
 }
});
test('共有シールドを公開して持ち主が処理し、手札への移動も持ち主へ戻す',()=>{
 const {r,run}=setup();const first={...r.teams[0].shields[0]},second={...r.teams[0].shields[1]};
 const before=structuredClone(r);assert.throws(()=>run(1,'teamShield',{id:first.id,to:'hand'}));assert.deepEqual(r,before);assert.throws(()=>run(0,'teamShield',{id:second.id,to:'hand'}));
 run(2,'teamShield',{id:first.id,to:'resolving'});assert.equal(r.players[first.owner].resolving[0].id,first.id);assert.ok(view(r,1).players[first.owner].resolving.some(c=>c.number===first.number));
 assert.throws(()=>run(2,'move',{from:'resolving',id:first.id,to:'trash'}));run(first.owner,'move',{from:'resolving',id:first.id,to:'trash'});assert.equal(r.players[first.owner].trash.at(-1).number,first.number);
 const counts=r.players.map(p=>p.hand.length);run(0,'teamShield',{id:second.id,to:'hand'});assert.equal(r.players[second.owner].hand.length,counts[second.owner]+1);assert.ok(r.players[second.owner].hand.some(c=>c.number===second.number&&c.id!==second.id));assert.equal(r.teams[0].shields.length,6);
});
test('共有シールドへの追加は所有者と上下順を保持する',()=>{
 const {r,run}=setup();let c=r.players[2].hand[0];run(2,'move',{from:'hand',id:c.id,to:'shields'});assert.equal(r.teams[0].shields[0].number,c.number);assert.equal(r.teams[0].shields[0].owner,2);
 c=r.players[0].hand[0];run(0,'move',{from:'hand',id:c.id,to:'shields',position:'bottom'});assert.equal(r.teams[0].shields.at(-1).number,c.number);assert.equal(r.teams[0].shields.at(-1).owner,0);
});
test('共有ベースは味方が操作でき、相手は操作できず、配備時に古いベースを入れ替える',()=>{
 const {r,run}=setup();const old=r.teams[0].base[0].id;run(2,'teamBase',{id:old,operation:'damage',delta:1});assert.equal(r.teams[0].base[0].damage,1);assert.throws(()=>run(1,'teamBase',{id:old,operation:'rest'}));
 const p=r.players[2];if(!['hand','deck'].some(z=>p[z].some(c=>c.type==='ベース'))){const n=r.teams[0].shields.findIndex(c=>c.owner===2&&c.type==='ベース');assert.ok(n>=0);p.hand.push(r.teams[0].shields.splice(n,1)[0])}const source=['hand','deck'].find(z=>p[z].some(c=>c.type==='ベース'));assert.ok(source);const c=p[source].find(c=>c.type==='ベース');const before=structuredClone(r);
 assert.throws(()=>run(2,'move',{from:source,id:c.id,to:'base'}));assert.deepEqual(r,before);run(2,'move',{from:source,id:c.id,to:'base',replaceBase:old});assert.equal(r.teams[0].base[0].owner,2);assert.ok(r.players[0].removed.some(c=>c.id===old));
 const current=r.teams[0].base[0];run(0,'teamBase',{id:current.id,operation:'move',to:'hand'});assert.ok(r.players[2].hand.some(c=>c.number===current.number));assert.equal(r.teams[0].base.length,0);
});
test('チームの両者が同時にリソース・ドローを進め、リーダーだけがフェイズを進める',()=>{
 const {r,run}=setup();const before=structuredClone(r);assert.throws(()=>run(2,'phase'));assert.deepEqual(r,before);run(0,'phase');run(0,'phase');assert.equal(r.turn,1);assert.deepEqual(r.players.map(p=>p.hand.length),[6,6,6,6]);assert.deepEqual(r.players.map(p=>p.resources.length),[1,2,1,2]);
 run(1,'phase');run(1,'phase');assert.equal(r.turn,0);assert.deepEqual(r.players.map(p=>p.hand.length),[7,6,7,6]);assert.deepEqual(r.players.map(p=>p.resources.length),[2,2,2,2]);
});
test('フェイズ停止と手札上限はチームの両者に適用し、失敗時は進行しない',()=>{
 const {r,run}=setup();run(3,'stepMode',{enabled:true});run(0,'phase');run(0,'phase');assert.equal(r.phase,0);const lengths=r.players.map(p=>p.hand.length);run(1,'phase');assert.equal(r.players[1].hand.length,lengths[1]+1);assert.equal(r.players[3].hand.length,lengths[3]+1);run(1,'phase');run(1,'phase');run(1,'phase');assert.equal(r.phase,4);
 while(r.players[3].hand.length<=10)run(3,'draw');const before=structuredClone(r);assert.throws(()=>run(1,'phase'));assert.deepEqual(r,before);
});
test('味方の支払い・セット・カード移動を代行できない',()=>{
 const {r,run}=setup(),id=cardTo(r,run,2,'ユニット','battle');assert.throws(()=>run(0,'move',{from:'battle',id,to:'trash'}));assert.throws(()=>run(0,'rest',{from:'battle',id}));
 const before=r.players[2].resources.map(c=>c.rest);run(0,'pay',{count:1,useEX:false});assert.deepEqual(r.players[2].resources.map(c=>c.rest),before);
 const pilot=r.players[0].deck.find(c=>c.type==='パイロット');if(pilot){run(0,'move',{from:'deck',id:pilot.id,to:'hand'});const pc=r.players[0].hand.find(c=>c.number===pilot.number);assert.throws(()=>run(0,'attach',{from:'hand',id:pc.id,target:id}))}
});
test('チーム6体制限と味方ユニットの入れ替え、失敗時の原子性',()=>{
 const {r,run}=setup();run(0,'createToken',{number:'T-001',count:3,rest:false});run(2,'createToken',{number:'T-001',count:3,rest:false});const before=structuredClone(r);assert.throws(()=>run(2,'createToken',{number:'T-001',count:1,rest:false}));assert.deepEqual(r,before);
 const removed=r.players[0].battle[0].id;run(2,'createToken',{number:'T-001',count:1,rest:false,replaceUnits:[{player:0,id:removed}]});assert.equal(r.players[0].battle.length+r.players[2].battle.length,6);assert.ok(r.players[0].removed.some(c=>c.id===removed));
 const saved=structuredClone(r);assert.throws(()=>run(2,'createToken',{number:'INVALID',count:1,rest:false,replaceUnits:[{player:0,id:r.players[0].battle[0].id}]}));assert.deepEqual(r,saved);
});
test('共有ベースの一時補正とアクティブ化、チームターン期限',()=>{
 const {r,run}=setup(),id=r.teams[0].base[0].id;run(2,'teamBase',{id,operation:'modifier',ap:0,hp:2,note:'このターン',duration:'turn',skipRefresh:true});run(2,'teamBase',{id,operation:'rest'});
 run(0,'phase');run(0,'phase');assert.equal(r.teams[0].base[0].modifier,undefined);run(1,'phase');run(1,'phase');assert.equal(r.teams[0].base[0].rest,true);run(0,'phase');run(0,'phase');run(1,'phase');run(1,'phase');assert.equal(r.teams[0].base[0].rest,false);
});
test('山札切れ・投了・直接攻撃の勝利は個人ではなくチームの結果になる',()=>{
 for(const loser of [0,1,2,3]){const {r,run}=setup();r.players[loser].deck=r.players[loser].deck.slice(0,1);run(loser,'draw');assert.equal(r.winner,1-loser%2);assert.equal(r.stage,'ended')}
 const {r,run}=setup();run(3,'concede');assert.equal(r.winner,0);assert.deepEqual(r.score,[1,0]);
 const game=setup();game.r.teams[1].base=[];game.r.teams[1].shields=[];game.run(2,'createToken',{number:'T-001',count:1,rest:false});const c=game.r.players[2].battle[0];game.run(2,'attackReady',{from:'battle',id:c.id,ready:true});assert.ok(view(game.r,0).canClaimVictory&&view(game.r,2).canClaimVictory);assert.equal(view(game.r,1).canClaimVictory,false);game.run(2,'claimVictory');assert.equal(game.r.winner,0);
});
test('チームのデッキ色・禁止制限の違反を開始前に止める',()=>{
 const {r,run}=setup();r.stage='lobby';run(2,'load',{deck:fixtureDeck('Blue')});assert.ok(view(r,0).deckIssues.some(x=>x.includes('色')));assert.throws(()=>run(0,'start'));
 const fresh=setup().r;fresh.players[2].registeredDeck[0].number='ST05-010';fresh.players[0].registeredDeck[0].number='ST01-010';assert.ok(teamDeckIssues(fresh,catalog).some(x=>x.includes('禁止ペア')));
});
test('席を変えてもトークン・ホスト権限を維持し、新しい席へ復帰する',()=>{
 const {r,run}=setup();r.stage='lobby';const token=r.hostToken;const result=run(0,'swapSeats',{left:0,right:2});assert.equal(result.me,2);assert.equal(result.host,2);assert.equal(seat(r,token),2);assert.equal(r.firstSelected,null);assert.throws(()=>run(0,'swapSeats',{left:0,right:1}));
 r.dice={rolls:[6,1],winner:0,round:1};run(0,'chooseFirst',{first:1});assert.throws(()=>run(0,'start'));run(2,'start');assert.equal(r.first,1);
});
test('BO3・サイド確定・敗者リーダーの選択・全員の再戦に対応',()=>{
 const {r,run}=setup({bestOf:3});run(2,'concede');run(0,'nextGame');assert.equal(r.stage,'sideboard');assert.equal(view(r,2).firstChooser,0);run(0,'chooseFirst',{first:1});for(let i=0;i<4;i++)run(i,'sideReady',{ready:true});run(0,'startNext');for(const i of [1,3,0,2])run(i,'keep');run(0,'concede');assert.equal(r.matchWinner,1);
 for(let i=0;i<3;i++)run(i,'rematch',{choice:'same'});assert.equal(r.stage,'ended');run(3,'rematch',{choice:'same'});assert.equal(r.stage,'lobby');assert.deepEqual(r.score,[0,0]);assert.ok(r.teams.every(t=>t.shields.length===0&&t.base.length===0));
});
test('HTTPで4人に別々の参加権限を返し、競合・再接続・秘密情報を管理する',async t=>{
 const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));const base='http://127.0.0.1:'+server.address().port;
 const post=async(path,data,token)=>{const res=await fetch(base+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)});return {status:res.status,...await res.json()}};
 const created=await post('create',{name:'host',mode:'solo',format:'team'}),code=created.state.code,clients=[created];assert.equal(created.status,200);
 for(let i=1;i<4;i++)clients.push(await post('join',{name:'p'+i,code}));assert.equal(new Set(clients.map(c=>c.token)).size,4);assert.deepEqual(clients.map(c=>c.state.me),[0,1,2,3]);assert.equal((await post('join',{name:'full',code})).status,400);
 let revision=clients.at(-1).state.revision;for(let i=0;i<4;i++){const res=await post('action',{code,type:'load',revision,deck:fixtureDeck(['Blue','Red','Green','White'][i])},clients[i].token);assert.equal(res.status,200);revision=res.state.revision}
 const stale=await post('action',{code,type:'stepMode',revision:revision-1,enabled:true},clients[0].token);assert.equal(stale.status,400);
 const states=await Promise.all(clients.map(async c=>(await fetch(base+'/api/state?code='+code,{headers:{Authorization:'Bearer '+c.token}})).json()));assert.ok(states.every(s=>s.revision===revision));assert.ok(states.every(s=>s.players.length===4&&s.capacity===4));
});
test('空席があるチーム部屋は2人・3人でも一覧に残り、満員だけ一覧から外す',async t=>{
 const r=room('host',1,'team');r.hostAddress='127.0.0.1';const service=discoveryService({rooms:new Map([[r.code,r]]),port:0,targets:['127.0.0.1'],waitMs:100});t.after(()=>service.close());const net={name:'test',address:'127.0.0.1',netmask:'255.0.0.0'};await service.advertise(net,'http://127.0.0.1:8788');
 const finder=discoveryService({rooms:new Map(),port:service.port,targets:['127.0.0.1'],waitMs:100});t.after(()=>finder.close());
 for(let n=1;n<=4;n++){const found=await finder.find([net]);assert.equal(found.rooms.length,n===4?0:1);if(n<4){assert.equal(found.rooms[0].players,n);assert.equal(found.rooms[0].format,'team');join(r,'p'+n)}}
});
test('別々の4アプリ間で中継し、席交換後も同じ参加者として再接続できる',async t=>{
 const servers=Array.from({length:4},()=>createServer());for(const server of servers)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>Promise.all(servers.map(server=>new Promise(resolve=>server.close(resolve)))));
 const urls=servers.map(server=>'http://127.0.0.1:'+server.address().port);
 const call=async(i,path,data,token)=>{const res=await fetch(urls[i]+'/api/'+path,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',...(i?{'X-GCG-Peer':urls[0]}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(data?{body:JSON.stringify(data)}:{})});return {status:res.status,...await res.json()}};
 const host=await call(0,'create',{name:'host',format:'team'}),code=host.state.code,clients=[host];for(let i=1;i<4;i++)clients.push(await call(i,'join',{name:'p'+i,code}));
 assert.ok(clients.every(c=>c.status===200));let revision=clients[3].state.revision;
 for(let i=0;i<4;i++){const res=await call(i,'action',{code,type:'load',revision,deck:fixtureDeck(['Blue','Red','Green','White'][i])},clients[i].token);assert.equal(res.status,200);revision=res.state.revision}
 const swapped=await call(0,'action',{code,type:'swapSeats',left:0,right:2,revision},host.token);assert.equal(swapped.state.me,2);assert.equal(swapped.state.host,2);
 const expected=[2,1,0,3];for(let i=0;i<4;i++){const res=await call(i,'state?code='+code,null,clients[i].token);assert.equal(res.state,undefined);assert.equal(res.me,expected[i]);assert.equal(res.players[res.me].name,i===0?'host':'p'+i)}
});
