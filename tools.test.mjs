import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {room,join,act,view} from './engine.mjs';
import {cardStats} from './public/card-stats.js';
import {createServer} from './server.mjs';
const deck=readFileSync(new URL('./public/sample-deck.txt',import.meta.url),'utf8');
function setup(){const r=room('A',3);join(r,'B');const run=(i,type,a={})=>act(r,i,{type,revision:r.revision,...a});for(let i=0;i<2;i++)run(i,'load',{deck});r.dice={rolls:[6,1],winner:0,round:1};run(0,'chooseFirst',{first:0});run(0,'start');run(0,'keep');run(1,'keep');return {r,run}}
function field(r,run,number){let p=r.players[0],c=p.deck.find(c=>c.number===number)||p.hand.find(c=>c.number===number);if(!c){c=p.shields.find(c=>c.number===number);run(0,'move',{from:'shields',id:c.id,to:'battle'})}else run(0,'move',{from:p.deck.includes(c)?'deck':'hand',id:c.id,to:'battle'});return c}

test('通常リソースの一括支払いは不足時に変更せず、直後だけ取り消せる',()=>{
 const {r,run}=setup();for(let n=0;n<4;n++)run(0,'resource');const before=structuredClone(r.players[0].resources);run(0,'pay',{count:4,useEX:false});assert.equal(r.players[0].resources.filter(c=>c.rest).length,4);assert.equal(view(r,0).players[0].canUndoPayment,true);run(0,'undoPayment');assert.deepEqual(r.players[0].resources,before);const prior=structuredClone(r);assert.throws(()=>run(0,'pay',{count:6}));assert.deepEqual(r,prior);run(0,'pay',{count:2});run(1,'draw');assert.throws(()=>run(0,'undoPayment'));assert.equal(r.players[0].resources.filter(c=>c.rest).length,2);
});
test('EX込みの支払いはEXを除外し通常リソースを残し、取り消しでEXも戻す',()=>{
 const {r,run}=setup();run(1,'resource');const p=r.players[1],ex=p.resources.find(c=>c.number==='EXR-001');run(1,'pay',{count:1,useEX:true});assert.ok(p.removed.includes(ex));assert.equal(p.resources.filter(c=>c.rest).length,0);run(1,'undoPayment');assert.equal(p.resources.length,2);assert.equal(p.removed.length,0);run(1,'pay',{count:2,useEX:true});assert.equal(p.resources[0].rest,true);assert.equal(p.removed[0].number,'EXR-001');assert.equal(r.turn,0);
});
test('デッキ上部は本人だけに見せ、キャンセル・再接続で順序と枚数を維持する',()=>{
 const {r,run}=setup(),original=structuredClone(r.players[0].deck);run(0,'peek',{count:3});assert.deepEqual(view(r,0).players[0].peek.cards,original.slice(0,3));assert.deepEqual(view(r,1).players[0].peek,{count:3});assert.equal(view(r,1).players[0].deck,original.length);assert.ok(!JSON.stringify(view(r,1)).includes(original[0].id));assert.ok(!JSON.stringify(r.log).includes(original[0].name));
 for(const [type,a] of [['draw',{}],['shuffle',{}],['search',{}],['move',{from:'hand',id:r.players[0].hand[0].id,to:'deck'}],['phase',{}]])assert.throws(()=>run(0,type,a),/確認|確定/);
 run(1,'peek',{count:2});assert.equal(view(r,0).players[1].peek.cards,undefined);run(1,'cancelPeek');run(0,'cancelPeek');assert.deepEqual(r.players[0].deck,original);
});
test('選択したカードだけ公開して手札へ、残りだけ無作為に下へ移動する',()=>{
 const {r,run}=setup(),p=r.players[0],original=[...p.deck],hand=p.hand.length;run(0,'peek',{count:3});const chosen=original[1],rest=[original[0],original[2]];run(0,'finishPeek',{ids:[chosen.id],to:'hand',reveal:true,remainder:'randomBottom'});assert.equal(p.hand.length,hand+1);assert.equal(p.hand.at(-1).number,chosen.number);assert.deepEqual(p.deck.slice(0,-2),original.slice(3));assert.deepEqual(p.deck.slice(-2).map(c=>c.number).sort(),rest.map(c=>c.number).sort());const v=view(r,1);assert.equal(v.reveals[0].cards.length,1);assert.equal(v.reveals[0].cards[0].number,chosen.number);assert.notEqual(v.reveals[0].cards[0].id,chosen.id);assert.equal(v.players[0].peek,null);assert.equal(typeof v.players[0].hand,'number');
});
test('上へ指定順で戻す・非公開で回収・全枚数より多く見る要求に対応する',()=>{
 const {r,run}=setup(),p=r.players[0],old=[...p.deck];run(0,'peek',{count:3});run(0,'finishPeek',{ids:[],to:'hand',reveal:false,remainder:'top',order:[old[2].id,old[1].id,old[0].id]});assert.deepEqual(p.deck.slice(0,3),[old[2],old[1],old[0]]);run(0,'peek',{count:50});assert.equal(p.peek.ids.length,p.deck.length);run(0,'finishPeek',{ids:[p.deck[0].id],to:'hand',reveal:false,remainder:'bottom'});assert.equal(r.reveals.length,0);assert.equal(p.deck.length,old.length-1);
});
test('確認中の不正ID・二重選択・不正な戻し順は公開も移動もせず拒否する',()=>{
 const {r,run}=setup();run(0,'peek',{count:3});const ids=r.players[0].peek.ids;for(const a of [{ids:['other']},{ids:[ids[0],ids[0]]},{ids:[],order:[ids[0]]},{ids:[],order:[ids[0],ids[0],ids[1]]},{ids:[],to:'unknown'}]){const before=structuredClone(r);assert.throws(()=>run(0,'finishPeek',{ids:[],to:'hand',reveal:true,remainder:'top',...a}));assert.deepEqual(r,before)}
});
test('複数カード移動は全件成功か全件拒否で、順序・非公開情報を維持する',()=>{
 const {r,run}=setup(),cards=r.players[0].hand.slice(0,3),before=structuredClone(r);assert.throws(()=>run(0,'batchMove',{from:'hand',ids:[cards[0].id,'other'],to:'trash'}));assert.deepEqual(r,before);run(0,'batchMove',{from:'hand',ids:cards.map(c=>c.id),to:'deck',position:'top'});assert.deepEqual(r.players[0].deck.slice(0,3).map(c=>c.number),cards.map(c=>c.number));assert.ok(!JSON.stringify(r.log.slice(0,3)).includes(cards[0].name));const ids=r.players[0].hand.map(c=>c.id);run(0,'batchMove',{from:'hand',ids,to:'trash'});assert.equal(r.players[0].hand.length,0);assert.equal(r.players[0].trash.length,ids.length);
});
test('ユニットとセットカードを同時に山札へ戻せ、単体移動時はセットカードをトラッシュへ送る',()=>{
 const {r,run}=setup(),unit=field(r,run,'ST01-001'),pilot=field(r,run,'ST01-010');run(0,'attach',{from:'battle',id:pilot.id,target:unit.id});run(0,'batchMove',{from:'battle',ids:[unit.id,pilot.id],to:'deck',position:'top'});assert.deepEqual(r.players[0].deck.slice(0,2).map(c=>c.number),['ST01-001','ST01-010']);assert.equal(r.players[0].trash.length,0);const u=field(r,run,'ST01-001'),p=field(r,run,'ST01-010');run(0,'attach',{from:'battle',id:p.id,target:u.id});run(0,'batchMove',{from:'battle',ids:[u.id],to:'removed'});assert.ok(r.players[0].trash.some(c=>c.number==='ST01-010'));
});
test('セット時の印刷AP・HPと手動補正を合算し、解除時は戻り、ダメージと混同しない',()=>{
 const {r,run}=setup(),unit=field(r,run,'ST01-001'),pilot=field(r,run,'ST01-010');assert.deepEqual([unit.ap,unit.hp],[3,4]);run(0,'attach',{from:'battle',id:pilot.id,target:unit.id});assert.deepEqual([cardStats(unit,r.players[0].battle).ap,cardStats(unit,r.players[0].battle).hp],[5,5]);run(0,'modifier',{from:'battle',id:unit.id,ap:1,hp:-1,note:'確認',duration:'manual',skipRefresh:false});run(0,'damage',{from:'battle',id:unit.id,delta:1});assert.deepEqual([cardStats(unit,r.players[0].battle).ap,cardStats(unit,r.players[0].battle).hp],[6,4]);assert.equal(unit.damage,1);run(0,'move',{from:'battle',id:pilot.id,to:'trash'});assert.equal(cardStats(unit,r.players[0].battle).ap,4);const cmd=field(r,run,'ST01-013');run(0,'attach',{from:'battle',id:cmd.id,target:unit.id});assert.equal(cardStats(unit,r.players[0].battle).ap,5);const opponent=view(r,1);assert.equal(cardStats(opponent.players[0].battle.find(c=>c.id===unit.id),opponent.players[0].battle).ap,5);
});
test('ターン期限の補正を解除し、次の自分のスタートを1回だけレストで通過する',()=>{
 const {r,run}=setup(),c=field(r,run,'ST01-001');run(0,'rest',{from:'battle',id:c.id});run(0,'modifier',{from:'battle',id:c.id,ap:2,hp:1,note:'このターン',duration:'turn',skipRefresh:true});run(0,'phase');assert.ok(c.modifier);run(0,'phase');assert.equal(c.modifier,undefined);assert.equal(c.skipRefresh,true);run(1,'phase');run(1,'phase');assert.equal(c.rest,true);assert.equal(c.skipRefresh,false);run(0,'phase');run(0,'phase');run(1,'phase');run(1,'phase');assert.equal(c.rest,false);
});
test('相手の補正操作を拒否し、EXベースの除外と新ゲームでの確認状態クリアに対応する',()=>{
 const {r,run}=setup(),c=field(r,run,'ST01-001');assert.throws(()=>run(1,'modifier',{from:'battle',id:c.id,ap:1,hp:1,note:'',duration:'manual',skipRefresh:false}));const ex=r.players[0].base[0];run(0,'move',{from:'base',id:ex.id,to:'removed'});assert.equal(r.players[0].removed[0].number,'EXBP-001');run(0,'revealCards',{from:'hand',ids:[r.players[0].hand[0].id]});run(0,'peek',{count:3});run(0,'concede');run(0,'nextGame');run(0,'chooseFirst',{first:0});for(let i=0;i<2;i++)run(i,'sideReady',{ready:true});run(0,'startNext');assert.equal(r.reveals.length,0);assert.equal(r.players[0].peek,null);
});
test('HTTP経由でも上部の内容は本人だけに返り、公開したカードだけが相手に届く',async t=>{
 const {r}=setup(),rooms=new Map([[r.code,r]]),server=createServer({rooms});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));const base='http://127.0.0.1:'+server.address().port;
 const get=async i=>(await fetch(base+'/api/state?code='+r.code,{headers:{Authorization:'Bearer '+r.players[i].token}})).json();
 const post=async(i,type,args)=>{const res=await fetch(base+'/api/action',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+r.players[i].token},body:JSON.stringify({code:r.code,revision:r.revision,type,...args})});assert.equal(res.status,200);return res.json()};
 const me=await post(0,'peek',{count:3});assert.equal(me.state.players[0].peek.cards.length,3);assert.deepEqual((await get(1)).players[0].peek,{count:3});await post(0,'finishPeek',{ids:[me.state.players[0].peek.cards[0].id],to:'hand',reveal:true,remainder:'randomBottom'});const other=await get(1);assert.equal(other.reveals[0].cards.length,1);assert.equal(other.players[0].peek,null);
 for(const file of ['/table-tools.js','/card-stats.js'])assert.equal((await fetch(base+file)).status,200);
});
