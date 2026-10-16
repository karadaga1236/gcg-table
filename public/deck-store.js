export const PREFIX='gcg-library-v1:';
export const cardTypes=['ユニット','パイロット','コマンド','ベース'];
const id=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
export function validateCards(cards){
 if(!Array.isArray(cards)||cards.length>200)throw Error('デッキの形式が正しくありません。');
 const seen=new Set();return cards.map(c=>{if(!c||!Number.isInteger(c.count)||c.count<1||c.count>4||! /^[A-Z]{1,4}\d{0,3}-\d{1,4}$/.test(c.number)||seen.has(c.number)||!cardTypes.includes(c.type))throw Error('枚数・カード番号・種類を確認してください。同じ番号は4枚までです。');seen.add(c.number);const out={number:c.number,count:c.count,type:c.type};for(const k of ['name','note','color','level','cost','ap','hp','traits','effect','link','title','set']){out[k]=String(c[k]||'').slice(0,k==='effect'?3000:300);if(/[|\r\n]/.test(out[k])&&['name','note'].includes(k))out[k]=out[k].replace(/[|\r\n]/g,' ')}if(!out.name)throw Error('カード名がありません。');return out});
}
export function validateDeckParts(cards,sideboard=[]){
 cards=validateCards(cards);sideboard=validateCards(sideboard);if(totals(sideboard).count>10)throw Error('サイドボードは10枚までです。');const counts=new Map();for(const c of [...cards,...sideboard]){const count=(counts.get(c.number)||0)+c.count;if(count>4)throw Error('同じ番号はメインとサイドボードを合わせて4枚までです。');counts.set(c.number,count)}return {cards,sideboard};
}
export function deckText(cards){return validateCards(cards).map(c=>`${c.count} | ${c.number} | ${c.name} | ${c.type} | ${c.note}`).join('\n')}
export function textDeck(text,catalog){const byNo=new Map(catalog.map(c=>[c.number,c]));return validateCards(text.trim().split(/\r?\n/).filter(Boolean).map(line=>{const [qty,number,name,type,note]=line.split('|').map(s=>s.trim());return {...byNo.get(number),number,name,type,note,count:Number(qty)}}))}
export function totals(cards){return {count:cards.reduce((n,c)=>n+c.count,0),colors:[...new Set(cards.flatMap(c=>(c.color||'').split(/[ /,]+/).filter(x=>x&&x!=='-'&&x!=='無色')))],types:cardTypes.map(t=>[t,cards.filter(c=>c.type===t).reduce((n,c)=>n+c.count,0)])}}
export function library(storage){
 const read=k=>{const s=storage.getItem(PREFIX+k);return s?JSON.parse(s):null};
 const write=(k,v)=>{try{storage.setItem(PREFIX+k,JSON.stringify(v))}catch{throw Error('保存できません。ブラウザーの保存容量・設定を確認し、書き出しで控えを残してください。')}};
 const all=kind=>{const a=[];for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key?.startsWith(PREFIX+kind+':'))a.push(read(key.slice(PREFIX.length)))}return a};
 return {
 profiles:()=>all('profile').sort((a,b)=>a.created-b.created),
 createProfile(name){name=String(name).trim().slice(0,24);if(!name)throw Error('プレイヤー名を入力してください。');const p={id:id(),name,created:Date.now()};write('profile:'+p.id,p);return p},
 decks:profile=>all('deck').filter(d=>d.profile===profile).sort((a,b)=>b.updated-a.updated),
 save(profile,deck){if(!read('profile:'+profile))throw Error('プレイヤーを選んでください。');const name=String(deck.name||'').trim().slice(0,60);if(!name)throw Error('デッキ名を入力してください。');const {cards,sideboard}=validateDeckParts(deck.cards,deck.sideboard||[]);const old=deck.id?read('deck:'+deck.id):null;if(old&&(old.profile!==profile||old.revision!==deck.revision))throw Error('別の画面で更新されています。「別名で保存」を使うか、マイデッキから読み直してください。');const d={id:old?.id||id(),profile,name,cards,sideboard,revision:(old?.revision||0)+1,updated:Date.now()};write('deck:'+d.id,d);return d},
 exportProfile(profile){const p=read('profile:'+profile);if(!p)throw Error('プレイヤーがありません。');return {format:'gcg-table-decks',version:2,player:p.name,decks:all('deck').filter(d=>d.profile===profile).map(d=>({name:d.name,cards:d.cards,sideboard:d.sideboard||[]}))}},
 importProfile(data){if(data?.format!=='gcg-table-decks'||![1,2].includes(data.version)||!Array.isArray(data.decks)||data.decks.length>200||typeof data.player!=='string')throw Error('GCG TABLEのデッキ控えファイルを選んでください。');const decks=data.decks.map(d=>{if(typeof d.name!=='string'||!d.name.trim())throw Error('デッキ名がありません。');return {name:d.name,...validateDeckParts(d.cards,d.sideboard||[])}});const p=this.createProfile(data.player+'（読込）');for(const d of decks)this.save(p.id,d);return p}
 };
}
