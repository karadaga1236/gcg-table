import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from './server.mjs';
import {lobbyNetwork} from './lobby-network.mjs';
import {invitation,parseInvitation} from './public/invitation.js';
async function serve(t,options){const s=createServer(options);await new Promise(r=>s.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>s.close(r)));return 'http://127.0.0.1:'+s.address().port}
async function post(base,route,data,headers={}){const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(data)});return {status:r.status,data:await r.json()}}
test('招待情報は接続先と部屋番号をまとめ、不正な形式を拒否する',()=>{
 const value=invitation('http://26.1.2.3:8788','ABCDEF123456');
 assert.deepEqual(parseInvitation('  '+value+'  '),{peer:'http://26.1.2.3:8788',code:'ABCDEF123456'});
 assert.equal(parseInvitation('gcg://25.2.3.4:8788/abcdef123456').code,'ABCDEF123456');
 for(const bad of ['hello','http://26.1.2.3:8788/ABCDEF123456','gcg://26.1.2.3/ABCDEF123456','gcg://user@26.1.2.3:8788/ABCDEF123456','gcg://26.1.2.3:80/ABCDEF123456','gcg://256.1.2.3:8788/ABCDEF123456',value+'?x=1',value+'#x',value+'/','gcg://example.com:8788/ABCDEF123456'])assert.throws(()=>parseInvitation(bad));
});
test('VPNの接続を再検出し、一覧にない接続先では受付しない',async t=>{
 let choices=[];const net=lobbyNetwork({rooms:new Map(),port:0,interfaces:()=>choices});t.after(()=>net.close());
 assert.deepEqual(net.list(),[]);await assert.rejects(()=>net.open(''),/VPNが見つかりません/);
 choices=[{name:'テストVPN',address:'127.0.0.1'}];assert.equal(net.list().length,1);
 await assert.rejects(()=>net.open('0.0.0.0'),/選んで/);
 const [a,b]=await Promise.all([net.open('127.0.0.1'),net.open('127.0.0.1')]);assert.equal(a,b);
 assert.equal((await fetch(a+'/peer-info')).status,200);
});
test('部屋作成時だけVPN受付を開始し、招待情報で別アプリから参加できる',async t=>{
 const rooms=new Map(),choices=[{name:'テストVPN',address:'127.0.0.1'}],net=lobbyNetwork({rooms,port:0,interfaces:()=>choices});t.after(()=>net.close());
 let opened=0;const network={list:()=>net.list(),open:address=>{opened++;return net.open(address)}};
 const host=await serve(t,{rooms,network}),guest=await serve(t,{});
 assert.equal((await(await fetch(host+'/api/local/connections')).json()).interfaces.length,1);assert.equal(opened,0);
 const invalid=await post(host,'/api/create',{name:'',mode:'vpn',interface:'127.0.0.1'});assert.equal(invalid.status,400);assert.equal(opened,0);
 const created=await post(host,'/api/create',{name:'Host',mode:'vpn',interface:'127.0.0.1'});assert.equal(created.status,200);assert.equal(opened,1);
 const {peer,code}=parseInvitation(created.data.invite);
 const joined=await post(guest,'/api/join',{name:'Guest',code},{'X-GCG-Peer':peer});assert.equal(joined.status,200);assert.equal(joined.data.state.players.length,2);
 assert.equal((await fetch(peer+'/api/local/connections')).status,403);
 assert.equal((await fetch(peer+'/api/local/library')).status,403);
 assert.equal((await post(peer,'/api/create',{mode:'vpn'})).status,403);
 const s=await fetch(guest+'/api/state?code='+code,{headers:{Authorization:'Bearer '+joined.data.token,'X-GCG-Peer':peer}});assert.equal(s.status,200);assert.equal((await s.json()).me,1);
});
test('一人用の部屋はVPN不要で同じPCから参加でき、VPN側からは入れない',async t=>{
 const rooms=new Map(),network={list:()=>[],open:()=>{throw Error('呼んではいけない')}};
 const host=await serve(t,{rooms,network}),vpn=await serve(t,{rooms,localAccess:false});
 const created=await post(host,'/api/create',{name:'A',mode:'solo'});assert.equal(created.status,200);
 const {peer,code}=parseInvitation(created.data.invite);assert.equal(peer,host);
 assert.equal((await post(vpn,'/api/join',{name:'B',code})).status,403);
 assert.equal((await post(host,'/api/join',{name:'B',code},{'X-GCG-Peer':peer})).status,200);
});
test('VPNが未接続の部屋作成は失敗し、部屋を残さない',async t=>{
 const rooms=new Map(),network=lobbyNetwork({rooms,port:0,interfaces:()=>[]});t.after(()=>network.close());
 const host=await serve(t,{rooms,network});const result=await post(host,'/api/create',{name:'A',mode:'vpn'});
 assert.equal(result.status,400);assert.match(result.data.error,/VPNが見つかりません/);assert.equal(rooms.size,0);
});
test('受付ポートの重複を案内し、前の受付終了後に再試行できる',async t=>{
 const blocker=createServer();await new Promise(r=>blocker.listen(0,'127.0.0.1',r));
 const net=lobbyNetwork({rooms:new Map(),port:blocker.address().port,interfaces:()=>[{name:'テストVPN',address:'127.0.0.1'}]});
 t.after(async()=>{if(blocker.listening)await new Promise(r=>blocker.close(r));await net.close()});
 await assert.rejects(()=>net.open('127.0.0.1'),/別の版が起動/);
 await new Promise(r=>blocker.close(r));const peer=await net.open('127.0.0.1');assert.equal((await fetch(peer+'/peer-info')).status,200);
});
