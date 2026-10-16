import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {room,join,act,view} from './engine.mjs';
import {matchesTraits} from './public/card-traits.js';
import {discoveryService,sameNetwork} from './discovery.mjs';
import {createServer} from './server.mjs';
import {lobbyNetwork} from './lobby-network.mjs';
const deck=readFileSync(new URL('./public/sample-deck.txt',import.meta.url),'utf8');
function setup(bestOf=1){const r=room('A',bestOf);join(r,'B');const run=(i,type,a={})=>act(r,i,{type,revision:r.revision,...a});for(let i=0;i<2;i++)run(i,'load',{deck});r.dice={rolls:[6,1],winner:0,round:1};run(0,'chooseFirst',{first:0});run(0,'start');run(0,'keep');run(1,'keep');run(0,'createToken',{number:'T-001',count:1,rest:false});return {r,run}}
test('特徴の複数選択はOR検索で、無選択は全件、効果文への言及では一致しない',()=>{
 const a={traits:'〔学園〕'},b={traits:'〔地球連邦〕'},c={traits:'〔CB〕',effect:'〔学園〕のカード'};
 assert.ok(matchesTraits(a,['学園','地球連邦']));assert.ok(matchesTraits(b,['学園','地球連邦']));assert.equal(matchesTraits(c,['学園','地球連邦']),false);assert.ok(matchesTraits(c,[]));assert.equal(matchesTraits(a,['学']),false);
});
test('勝利確定の表示は自分メイン・シールドとベース0・攻撃できるAPを持つユニットに限定',()=>{
 const {r,run}=setup();assert.equal(view(r,0).canClaimVictory,false);r.players[1].shields=[];r.players[1].base=[];assert.equal(view(r,0).canClaimVictory,false);const c=r.players[0].battle[0];run(0,'attackReady',{from:'battle',id:c.id,ready:true});assert.ok(view(r,0).canClaimVictory);assert.equal(view(r,1).canClaimVictory,false);
 c.rest=true;assert.equal(view(r,0).canClaimVictory,false);c.rest=false;c.ap=0;assert.equal(view(r,0).canClaimVictory,false);c.ap=3;r.phase=4;assert.equal(view(r,0).canClaimVictory,false);r.phase=3;r.players[0].peek={ids:[]};assert.equal(view(r,0).canClaimVictory,false);r.players[0].peek=null;r.players[1].base=[{id:'b'}];assert.equal(view(r,0).canClaimVictory,false);
});
test('勝利確定は勝者を正しく記録し、条件を満たさない操作は変更しない',()=>{
 const {r,run}=setup(3),before=structuredClone(r);assert.throws(()=>run(0,'claimVictory'));assert.deepEqual(r,before);r.players[1].base=[];r.players[1].shields=[];run(0,'attackReady',{from:'battle',id:r.players[0].battle[0].id,ready:true});run(0,'claimVictory');assert.equal(r.winner,0);assert.deepEqual(r.score,[1,0]);assert.equal(r.stage,'ended');assert.equal(r.matchWinner,null);assert.throws(()=>run(0,'claimVictory'));
});
test('自動検出は同じVPN内の空き部屋だけを返し、保存情報や参加トークンを返さない',async t=>{
 const rooms=new Map(),r=room('友人の部屋');r.hostAddress='127.0.0.1';rooms.set(r.code,r);const host=discoveryService({rooms,port:0});t.after(()=>host.close());assert.ok(await host.advertise({name:'test',address:'127.0.0.1'},'http://127.0.0.1:18903'));
 const guest=discoveryService({rooms:new Map(),port:host.port,targets:['127.0.0.1'],waitMs:160});t.after(()=>guest.close());const result=await guest.find([{name:'test',address:'127.0.0.1'}]);assert.equal(result.rooms.length,1);assert.equal(result.rooms[0].code,r.code);assert.equal(result.rooms[0].peer,'http://127.0.0.1:18903');assert.ok(!JSON.stringify(result).includes(r.players[0].token));
 act(r,0,{type:'hideRoom',revision:r.revision});assert.equal((await guest.find([{name:'test',address:'127.0.0.1'}])).rooms.length,0);r.listed=true;r.localOnly=true;assert.equal((await guest.find([{name:'test',address:'127.0.0.1'}])).rooms.length,0);r.localOnly=false;join(r,'満員');assert.equal((await guest.find([{name:'test',address:'127.0.0.1'}])).rooms.length,0);assert.ok(sameNetwork('26.2.3.4',{address:'26.1.1.1'}));assert.equal(sameNetwork('192.168.1.2',{address:'26.1.1.1'}),false);assert.equal((await guest.find([])).rooms.length,0);
});
test('部屋一覧をローカルAPIで取得し、部屋番号の手入力なしで別アプリから参加できる',async t=>{
 const interfaces=()=>[{name:'test',address:'127.0.0.1'}],rooms=new Map(),network=lobbyNetwork({rooms,port:0,interfaces,discoveryOptions:{port:0}});t.after(()=>network.close());
 async function serve(options){const s=createServer(options);await new Promise(r=>s.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>s.close(r)));return 'http://127.0.0.1:'+s.address().port}
 const host=await serve({rooms,network});const created=await(await fetch(host+'/api/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Host',mode:'vpn',interface:'127.0.0.1'})})).json();
 const guestNetwork=lobbyNetwork({rooms:new Map(),interfaces,discoveryOptions:{port:network.discoveryPort,targets:['127.0.0.1'],waitMs:160}});t.after(()=>guestNetwork.close());const guest=await serve({network:guestNetwork}),result=await(await fetch(guest+'/api/local/discover')).json();assert.equal(result.rooms.length,1);const found=result.rooms[0];assert.equal(found.code,created.state.code);
 const joined=await fetch(guest+'/api/join',{method:'POST',headers:{'Content-Type':'application/json','X-GCG-Peer':found.peer},body:JSON.stringify({name:'Guest',code:found.code})});assert.equal(joined.status,200);assert.equal((await joined.json()).state.me,1);const vpn=await serve({localAccess:false});assert.equal((await fetch(vpn+'/api/local/discover')).status,403);
});
