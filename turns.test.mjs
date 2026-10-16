import test from 'node:test';
import assert from 'node:assert/strict';
import {room,join,act,view} from './engine.mjs';
import {readFile} from 'node:fs/promises';
import {createServer} from './server.mjs';
const deck=await readFile(new URL('./public/sample-deck.txt',import.meta.url),'utf8');
function setup(step=false){const r=room('先攻');join(r,'後攻');const run=(i,type,a={})=>act(r,i,{type,revision:r.revision,...a});run(0,'load',{deck});run(1,'load',{deck});r.dice={rolls:[6,1],winner:0,round:1};run(0,'chooseFirst',{first:0});if(step)run(0,'stepMode',{enabled:true});run(0,'start');run(0,'keep');run(1,'keep');return {r,run}}
test('自動開始：先攻もドローし、次の自分のターンだけレストを解除する',()=>{
 const {r,run}=setup();assert.equal(r.phase,3);assert.equal(r.players[0].hand.length,6);assert.equal(r.players[0].resources.length,1);assert.equal(r.players[1].hand.length,5);
 const resource=r.players[0].resources[0];run(0,'rest',{from:'resources',id:resource.id});assert.equal(resource.rest,true);const revision=r.revision;
 run(0,'phase');assert.equal(r.phase,4);assert.equal(r.turn,0);run(0,'phase');assert.equal(r.turn,1);assert.equal(r.phase,3);assert.equal(r.players[1].hand.length,6);assert.equal(r.players[1].resources.length,2);assert.equal(resource.rest,true);
 assert.throws(()=>act(r,0,{type:'phase',revision}));assert.throws(()=>run(0,'phase'));run(1,'phase');run(1,'phase');assert.equal(r.turn,0);assert.equal(resource.rest,false);assert.equal(r.players[0].hand.length,7);assert.equal(r.players[0].resources.length,2);
});
test('フェイズ停止：各フェイズで1度だけ処理し、再取得では増えない',()=>{
 const {r,run}=setup(true);assert.equal(r.phase,0);assert.equal(r.players[0].hand.length,5);assert.equal(r.players[0].resources.length,0);
 run(0,'phase');assert.equal(r.phase,1);assert.equal(r.players[0].hand.length,6);view(r,0);view(r,1);assert.equal(r.players[0].hand.length,6);
 run(0,'phase');assert.equal(r.phase,2);assert.equal(r.players[0].resources.length,1);run(0,'phase');assert.equal(r.phase,3);assert.equal(r.players[0].resources.length,1);
});
test('リソース切れ・山札最後の1枚・エンドの手札上限',()=>{
 const {r,run}=setup(true);r.players[0].resourceDeck=[];run(0,'phase');run(0,'phase');assert.equal(r.stage,'play');assert.equal(r.players[0].resources.length,0);run(0,'phase');
 while(r.players[0].hand.length<11)run(0,'draw');run(0,'phase');assert.throws(()=>run(0,'phase'),/10枚/);run(0,'move',{from:'hand',id:r.players[0].hand[0].id,to:'trash'});run(0,'phase');assert.equal(r.turn,1);
 r.players[1].deck=r.players[1].deck.slice(0,1);run(1,'draw');assert.equal(r.stage,'ended');assert.equal(r.winner,0);
});
test('ダイスはサーバー生成・先攻決定後変更不可・同点は再ロール',()=>{
 const r=room('A');join(r,'B');const run=(i,type,a={})=>act(r,i,{type,revision:r.revision,...a});
 assert.throws(()=>run(0,'start'));run(0,'dice',{value:99});assert.ok(r.dice.rolls[0]>=1&&r.dice.rolls[0]<=6);assert.throws(()=>run(0,'dice'));
 r.dice.rolls=[3,3];run(1,'dice');assert.equal(r.dice.round,2);assert.equal(r.dice.rolls[0],null);
 run(0,'dice');if(r.dice.winner!==null){assert.equal(r.dice.winner,r.dice.rolls[0]>r.dice.rolls[1]?0:1);assert.throws(()=>run(1,'dice'))}
});
test('リソース画像・EX画像・裏面SVGを正しい形式で配信',async()=>{
 const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));try{const base='http://127.0.0.1:'+server.address().port;
 for(const n of ['R-001','EXR-001','EXBP-001']){const r=await fetch(base+'/cards/'+n+'.webp');assert.equal(r.status,200);assert.equal(Buffer.from(await r.arrayBuffer()).toString('ascii',8,12),'WEBP')}
 for(const n of ['card-back','resource-back']){const r=await fetch(base+'/'+n+'.svg');assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/svg+xml')}
 }finally{await new Promise(resolve=>server.close(resolve))}
});
