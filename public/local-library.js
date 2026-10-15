export async function localLibrary(){
 let state;
 async function request(operation,args){
  const surfaces=operation?[...document.querySelectorAll('main,dialog')]:[];
  for(const el of surfaces)el.inert=true;
  try{const r=await fetch('/api/local/library',{method:operation?'POST':'GET',headers:{'Content-Type':'application/json'},...(operation?{body:JSON.stringify({operation,args})}:{})});const data=await r.json();if(!r.ok)throw Error(data.error||'PCのフォルダーへの保存に失敗しました。');state=data;return data.result}
  finally{for(const el of surfaces)el.inert=false}
 }
 await request();return {
  get directory(){return state.directory},
  refresh:()=>request(),
  profiles:()=>state.profiles,
  decks:profile=>state.decks.filter(d=>d.profile===profile).sort((a,b)=>b.updated-a.updated),
  createProfile:name=>request('createProfile',{name}),
  save:(profile,deck)=>request('save',{profile,deck}),
  importProfile:data=>request('importProfile',{data}),
  migrate:(data,key)=>request('migrate',{data,key}),
  exportProfile(profile){const p=state.profiles.find(p=>p.id===profile);if(!p)throw Error('プレイヤーを選んでください。');return {format:'gcg-table-decks',version:1,player:p.name,decks:state.decks.filter(d=>d.profile===profile).map(d=>({name:d.name,cards:d.cards}))}}
 };
}
