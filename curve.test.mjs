import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {deckCurve} from './public/deck-curve.js';
import {textDeck,validateCards} from './public/deck-store.js';

test('マナカーブは採用枚数で数え、0コストと高コストも保持する',()=>{
 const curve=deckCurve([{cost:'0',count:3},{cost:'2',count:4},{cost:'2',count:1},{cost:'10',count:2}]);
 assert.equal(curve.bins[0].count,3);
 assert.equal(curve.bins[2].count,5);
 assert.equal(curve.bins[10].count,2);
 assert.equal(curve.total,10);
 assert.equal(curve.average,3);
 assert.equal(curve.bins.reduce((n,b)=>n+b.count,0),10);
});
test('コスト不明を0にせず、空デッキ・メインとサイドを個別に集計する',()=>{
 const empty=deckCurve([]);
 assert.equal(empty.total,0);assert.equal(empty.average,null);
 assert.ok(empty.bins.every(b=>b.count===0));
 const main=deckCurve([{cost:'-',count:2},{cost:'',count:1},{count:1},{cost:'2',count:4}]);
 const side=deckCurve([{cost:'5',count:1}]);
 assert.equal(main.unknown,4);assert.equal(main.average,2);assert.equal(main.bins[0].count,0);
 assert.equal(side.total,1);assert.equal(side.average,5);
});
test('保存・下書き復元でCOSTが省略されてもカタログから50枚を集計する',async()=>{
 const catalog=JSON.parse(await readFile(new URL('./public/catalog.json',import.meta.url),'utf8')).cards;
 const cards=textDeck(await readFile(new URL('./public/sample-deck.txt',import.meta.url),'utf8'),catalog);
 const byNumber=new Map(catalog.map(c=>[c.number,c]));
 const expected=deckCurve(cards);
 assert.deepEqual(deckCurve(validateCards(cards),byNumber),expected);
 assert.equal(expected.total,50);assert.equal(expected.unknown,0);
 assert.equal(expected.bins.reduce((n,b)=>n+b.count,0),50);
});
