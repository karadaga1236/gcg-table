import test from 'node:test';
import assert from 'node:assert/strict';
import {manaCurve,curveMarkup} from './public/deck-curve.js';
import {matchesSets,setOptions} from './public/card-sets.js';

test('マナカーブは採用枚数で集計し、10以上をまとめても平均は実COSTで計算する',()=>{
 const cards=[{number:'A',cost:'0',count:4},{number:'B',cost:'2',count:3},{number:'C',cost:'7',count:2},{number:'D',cost:'12',count:1}];
 const before=structuredClone(cards),result=manaCurve(cards,new Map(),'cost');
 assert.equal(result.total,10);assert.equal(result.average,3.2);assert.deepEqual(result.bins.map(b=>b.count),[4,0,3,0,0,0,0,2,0,0,1]);assert.deepEqual(cards,before);
});
test('保存データのCOST省略をカタログで補い、不明COSTは平均から除く',()=>{
 const result=manaCurve([{number:'A',count:3},{number:'B',cost:'-',count:2}],new Map([['A',{cost:'4'}]]),'cost');
 assert.equal(result.total,5);assert.equal(result.average,4);assert.equal(result.unknown,2);assert.deepEqual(result.bins.at(-1),{label:'?',count:2});
 const empty=manaCurve([]);assert.equal(empty.average,null);assert.equal(empty.total,0);assert.ok(!curveMarkup(empty).includes('NaN'));
});
test('初期基準はLv.で、COSTと独立して切り替えて集計する',()=>{
 const cards=[{number:'A',level:'4',cost:'1',count:3},{number:'B',level:'2',cost:'3',count:1}];
 const level=manaCurve(cards),cost=manaCurve(cards,new Map(),'cost');
 assert.equal(level.average,3.5);assert.equal(cost.average,1.5);assert.equal(level.bins[4].count,3);assert.equal(cost.bins[1].count,3);
 assert.ok(curveMarkup(level).includes('Lv. 4：3枚'));assert.ok(curveMarkup(cost).includes('COST 1：3枚'));
 const restored=manaCurve([{number:'A',count:4}],new Map([['A',{level:'5',cost:'2'}]]));assert.equal(restored.average,5);
});
test('弾は複数選択のORで照合し、未選択は全件、似た番号の弾を混同しない',()=>{
 const cards=[{number:'GD01-001'},{number:'GD02-001'},{number:'ST01-001'},{number:'GD010-001'}];
 assert.deepEqual(cards.filter(c=>matchesSets(c,['GD01','ST01'])).map(c=>c.number),['GD01-001','ST01-001']);assert.equal(cards.filter(c=>matchesSets(c,[])).length,4);
 assert.deepEqual(setOptions([...cards,cards[0]]),[['GD01',2],['GD010',1],['GD02',1],['ST01',1]]);
});
