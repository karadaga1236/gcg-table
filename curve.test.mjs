import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {cardsByCost,printedCost} from './public/deck-curve.js';
import {textDeck,validateCards} from './public/deck-store.js';
test('数値COST順・同COSTは番号順で表示し、保存順と採用枚数を変えない',()=>{
 const cards=[{number:'D',cost:'10',count:2},{number:'B',cost:'2',count:3},{number:'A',cost:'2',count:1},{number:'C',cost:'0',count:4}];
 const before=structuredClone(cards),sorted=cardsByCost(cards);
 assert.deepEqual(sorted.map(c=>c.number),['C','A','B','D']);assert.deepEqual(cards,before);
 assert.equal(sorted.reduce((n,c)=>n+c.count,0),10);
});
test('不明COSTは最後に番号順、空デッキとサイドも表示できる',()=>{
 const cards=[{number:'Z',cost:'-'},{number:'A',cost:''},{number:'B',cost:'3'}];
 assert.deepEqual(cardsByCost(cards).map(c=>c.number),['B','A','Z']);
 assert.equal(printedCost(cards[0]),null);assert.deepEqual(cardsByCost([]),[]);
 assert.deepEqual(cardsByCost([{number:'S',cost:'1'}]).map(c=>c.number),['S']);
});
test('保存・下書き復元でCOSTが省略されてもカタログから並びを復元する',async()=>{
 const catalog=JSON.parse(await readFile(new URL('./public/catalog.json',import.meta.url),'utf8')).cards;
 const cards=textDeck(await readFile(new URL('./public/sample-deck.txt',import.meta.url),'utf8'),catalog);
 const byNumber=new Map(catalog.map(c=>[c.number,c]));
 assert.deepEqual(cardsByCost(validateCards(cards),byNumber).map(c=>c.number),cardsByCost(cards).map(c=>c.number));
});
