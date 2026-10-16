import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {room,join,act,view} from './engine.mjs';
import {deployment,linked} from './public/unit-state.js';
import {dragChoice,bindDragging} from './public/table-interaction.js';
const deck=readFileSync(new URL('./public/sample-deck.txt',import.meta.url),'utf8');
function setup(){const r=room('A');join(r,'B');const run=(i,type,a={})=>act(r,i,{type,revision:r.revision,...a});for(let i=0;i<2;i++)run(i,'load',{deck});r.dice={rolls:[6,1],winner:0,round:1};run(0,'chooseFirst',{first:0});run(0,'start');run(0,'keep');run(1,'keep');return {r,run}}
function getCard(r,run,number,to='hand'){const p=r.players[0],from=['hand','deck','shields'].find(z=>p[z].some(c=>c.number===number)),c=p[from].find(c=>c.number===number);if(from!==to)run(0,'move',{from,id:c.id,to});return c}
test('EXリソースを効果で複数・レスト／アクティブ指定で追加し、相手に同期する',()=>{
 const {r,run}=setup();run(0,'addEX',{count:3,rest:true});const added=r.players[0].resources.slice(-3);assert.equal(new Set(added.map(c=>c.id)).size,3);assert.ok(added.every(c=>c.number==='EXR-001'&&c.rest&&c.token));assert.deepEqual(view(r,1).players[0].resources.slice(-3),added);run(1,'addEX',{count:2,rest:false});assert.ok(r.players[1].resources.slice(-2).every(c=>!c.rest));
 for(const args of [{count:0,rest:false},{count:1.5,rest:false},{count:11,rest:false},{count:1,rest:'false'}]){const before=structuredClone(r);assert.throws(()=>run(0,'addEX',args));assert.deepEqual(r,before)}
});
test('配備時に召喚酔いを表示し、通常リンク・手動指定・次ターンを区別する',()=>{
 const {r,run}=setup(),u=getCard(r,run,'ST01-001','battle'),p=getCard(r,run,'ST01-010');assert.equal(deployment(u,r.players[0].battle,r.round),'召喚酔い');run(0,'attach',{from:'hand',id:p.id,target:u.id});assert.equal(deployment(u,r.players[0].battle,r.round),'LINK');assert.equal(deployment(view(r,1).players[0].battle.find(c=>c.id===u.id),view(r,1).players[0].battle,r.round),'LINK');
 run(0,'attackReady',{from:'battle',id:u.id,ready:false});assert.equal(deployment(u,r.players[0].battle,r.round),'召喚酔い');run(0,'attackReady',{from:'battle',id:u.id,ready:true});assert.equal(deployment(u,r.players[0].battle,r.round),'攻撃可（手動）');run(0,'phase');run(0,'phase');assert.equal(deployment(u,r.players[0].battle,r.round),'');assert.throws(()=>run(1,'attackReady',{from:'battle',id:u.id,ready:true}));
});
test('再配備・山札確認からの配備・トークンにも配備ターンが付く',()=>{
 const {r,run}=setup(),u=getCard(r,run,'ST01-001','battle');run(0,'attackReady',{from:'battle',id:u.id,ready:true});run(0,'move',{from:'battle',id:u.id,to:'hand'});assert.equal(u.deployedTurn,undefined);assert.equal(u.attackReady,undefined);run(0,'move',{from:'hand',id:u.id,to:'battle'});assert.equal(deployment(u,r.players[0].battle,r.round),'召喚酔い');run(0,'token',{name:'確認用ユニット',to:'battle'});assert.equal(deployment(r.players[0].battle.at(-1),r.players[0].battle,r.round),'召喚酔い');
 const c=r.players[0].deck.find(c=>c.type==='ユニット');r.players[0].deck=[c,...r.players[0].deck.filter(x=>x!==c)];run(0,'peek',{count:1});run(0,'finishPeek',{ids:[c.id],to:'battle',reveal:true,remainder:'top'});assert.equal(deployment(c,r.players[0].battle,r.round),'召喚酔い');
});
test('コマンドのパイロット名・特徴・複数の名前のリンクを照合する',()=>{
 const {r,run}=setup(),c=getCard(r,run,'ST01-013');assert.equal(c.pilotName,'カイ・シデン');const unit={id:'u',link:'「カイ・シデン」'},pilot={...c,attachedTo:'u'};assert.ok(linked(unit,[unit,pilot]));assert.ok(linked({...unit,link:'特徴〔WB隊〕'},[unit,pilot]));assert.ok(linked({...unit,link:'「カイ・シデン」 「アムロ・レイ」'},[unit,pilot]));
});
test('トラッシュからの除外を相手に同期し、相手の操作と二重除外を拒否する',()=>{
 const {r,run}=setup(),c=getCard(r,run,'ST01-001','trash');
 const before=structuredClone(r);
 assert.throws(()=>run(1,'move',{from:'trash',id:c.id,to:'removed'}));assert.deepEqual(r,before);
 run(0,'move',{from:'trash',id:c.id,to:'removed'});
 assert.equal(r.players[0].trash.some(x=>x.id===c.id),false);
 assert.equal(view(r,1).players[0].removed.filter(x=>x.id===c.id).length,1);
 const after=structuredClone(r);
 assert.throws(()=>run(0,'move',{from:'trash',id:c.id,to:'removed'}));assert.deepEqual(r,after);
});
test('ドラッグは自分のカードのみ・相手側と同じ領域への誤移動を拒否する',()=>{
 const {r,run}=setup(),c=getCard(r,run,'ST01-001'),s=view(r,0),source={id:c.id,zone:'hand',player:0};
 const d=dragChoice(s,source,{zone:'battle',player:0});assert.equal(d.type,'move');run(0,d.type,d);assert.equal(r.players[0].battle[0].id,c.id);
 assert.equal(dragChoice(s,source,{zone:'battle',player:1}),null);assert.equal(dragChoice(s,{...source,player:1},{zone:'battle',player:0}),null);assert.equal(dragChoice(s,source,{zone:'hand',player:0}),null);assert.equal(dragChoice({...s,stage:'ended'},source,{zone:'battle',player:0}),null);
});
test('ドラッグでパイロットをセットし、コマンドは公開処理へ、山札には上へ戻す',()=>{
 const {r,run}=setup(),u=getCard(r,run,'ST01-001','battle'),p=getCard(r,run,'ST01-010'),cmd=getCard(r,run,'ST01-013');let s=view(r,0);let d=dragChoice(s,{id:p.id,zone:'hand',player:0},{id:u.id,zone:'battle',player:0});run(0,d.type,d);assert.equal(p.attachedTo,u.id);s=view(r,0);assert.equal(dragChoice(s,{id:cmd.id,zone:'hand',player:0},{id:u.id,zone:'battle',player:0}),null);d=dragChoice(s,{id:cmd.id,zone:'hand',player:0},{zone:'battle',player:0});assert.equal(d.to,'resolving');run(0,d.type,d);d=dragChoice(view(r,0),{id:cmd.id,zone:'resolving',player:0},{zone:'deck',player:0});run(0,d.type,d);assert.equal(r.players[0].deck[0].number,cmd.number);
});
test('ドラッグ先が空白・相手領域・山札確認中の場合は盤面操作を生成しない',()=>{
 const {r,run}=setup(),c=getCard(r,run,'ST01-001');run(0,'peek',{count:1});const s=view(r,0),source={id:c.id,zone:'hand',player:0};assert.equal(dragChoice(s,source,null),null);assert.equal(dragChoice(s,source,{zone:'deck',player:0}),null);const token=r.players[0].base[0];assert.equal(dragChoice(s,{id:token.id,zone:'base',player:0},{zone:'hand',player:0}),null);
});
test('ポインター操作はクリックと短い揺れで移動せず、ドラッグ完了・取消・競合を区別する',async()=>{
 const {r}=setup(),s=view(r,0),card=s.players[0].hand[0],handlers={},classes=()=>({add(){},remove(){}});let aimed=null,calls=[],notices=[];
 const source={dataset:{card:card.id,zone:'hand',player:'0'},closest(q){return q==='[data-card]'?this:null},cloneNode(){return {removeAttribute(){},style:{},remove(){}}}};
 const dest={dataset:{drop:'trash',owner:'0'},classList:classes(),closest(q){return q==='[data-drop]'?this:null}};
 const oldDocument=globalThis.document,oldWindow=globalThis.window;
 globalThis.document={querySelector:()=>null,elementFromPoint:()=>aimed,body:{append(){},classList:classes()},addEventListener:(name,fn)=>handlers[name]=fn};globalThis.window={addEventListener(){}};
 try{bindDragging(()=>s,async(t,a)=>{calls.push({t,a});return true},()=>{},m=>notices.push(m));const e=(x,y)=>({button:0,pointerId:1,target:source,clientX:x,clientY:y,preventDefault(){},stopImmediatePropagation(){}});
 handlers.pointerdown(e(0,0));handlers.pointermove(e(2,2));aimed=dest;await handlers.pointerup(e(2,2));assert.equal(calls.length,0);
 handlers.pointerdown(e(0,0));handlers.pointermove(e(40,40));await handlers.pointerup(e(40,40));assert.equal(calls.length,1);assert.equal(calls[0].a.to,'trash');
 handlers.pointerdown(e(0,0));handlers.pointermove(e(40,40));handlers.keydown({key:'Escape'});await handlers.pointerup(e(40,40));assert.equal(calls.length,1);
 handlers.pointerdown(e(0,0));handlers.pointermove(e(40,40));s.revision++;await handlers.pointerup(e(40,40));assert.equal(calls.length,1);assert.equal(notices.length,1);
 }finally{globalThis.document=oldDocument;globalThis.window=oldWindow}
});
