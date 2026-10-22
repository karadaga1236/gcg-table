export function printedCost(card, byNumber = new Map()) {
 const raw = byNumber.get(card.number)?.cost ?? card.cost;
 return /^(0|[1-9]\d?)$/.test(String(raw ?? '')) ? Number(raw) : null;
}
// Sort only the display; preserve saved order and copy counts.
export function cardsByCost(cards, byNumber = new Map()) {
 return [...cards].sort((a,b) =>
  (printedCost(a,byNumber) ?? Infinity) - (printedCost(b,byNumber) ?? Infinity)
  || a.number.localeCompare(b.number));
}

// Copy counts weight the histogram and average; unknown values are not zero.
export function manaCurve(cards, byNumber = new Map(), metric='level') {
 if(!['level','cost'].includes(metric))throw Error('集計基準が不正です。');
 const bins=Array.from({length:11},(_,n)=>({label:n===10?'10+':String(n),count:0}));
 let total=0,known=0,sum=0,unknown=0;
 for(const card of cards){
  const count=Number.isInteger(card.count)&&card.count>0?card.count:0;
  const raw=byNumber.get(card.number)?.[metric]??card[metric];
  const cost=/^(0|[1-9]\d?)$/.test(String(raw??''))?Number(raw):null;total+=count;
  if(cost===null){unknown+=count;continue}
  bins[Math.min(cost,10)].count+=count;known+=count;sum+=cost*count;
 }
 if(unknown)bins.push({label:'?',count:unknown});
 return {bins,total,unknown,metric,average:known?sum/known:null};
}

export function curveMarkup(curve){
 const width=296,height=56,step=width/curve.bins.length,max=Math.max(1,...curve.bins.map(b=>b.count));
 const bars=curve.bins.map((b,n)=>{
  const x=n*step+step/2,h=30*b.count/max;
  return `<g><rect class="curve-track" x="${x-10}" y="14" width="20" height="30" rx="2"/><rect class="curve-bar" x="${x-10}" y="${44-h}" width="20" height="${h}" rx="2"/><text class="curve-count" x="${x}" y="10">${b.count}</text><text class="curve-cost" x="${x}" y="55">${b.label}</text></g>`;
 }).join('');
 const description=curve.bins.map(b=>`${curve.metric==='level'?'Lv.':'COST'} ${b.label==='?'?'不明':b.label}：${b.count}枚`).join('、');
 return `<svg class="curve-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${description}">${bars}</svg>`;
}
