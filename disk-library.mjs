import {readFile,readdir,mkdir,writeFile,rename,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {library,PREFIX,validateCards} from './public/deck-store.js';
const validId=s=>typeof s==='string'&&/^[a-f0-9]{32}$/.test(s);
function memory(){const m=new Map();return {get length(){return m.size},key:i=>[...m.keys()][i],getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)}}
export function diskLibrary(directory){
 directory=path.resolve(directory);let queue=Promise.resolve();
 async function read(){
  const storage=memory(),imports=new Map();let files;try{files=await readdir(directory)}catch(e){if(e.code==='ENOENT')files=[];else throw e}
  for(const file of files.filter(f=>/^[a-f0-9]{32}\.json$/.test(f))){
   try{const raw=JSON.parse(await readFile(path.join(directory,file),'utf8')),p=raw.profile;
    if(raw.version!==1||!p||!validId(p.id)||file!==p.id+'.json'||typeof p.name!=='string'||!Number.isFinite(p.created)||!Array.isArray(raw.decks))throw Error('Invalid player');
    storage.setItem(PREFIX+'profile:'+p.id,JSON.stringify(p));
    for(const d of raw.decks){if(!validId(d.id)||d.profile!==p.id||!Number.isInteger(d.revision)||d.revision<1||!Number.isFinite(d.updated)||typeof d.name!=='string'||storage.getItem(PREFIX+'deck:'+d.id))throw Error('Invalid deck');validateCards(d.cards);storage.setItem(PREFIX+'deck:'+d.id,JSON.stringify(d))}
    if(raw.importKey)imports.set(p.id,raw.importKey);
   }catch(e){throw Error('保存ファイルを読めません：'+file+'。元のファイルを保管し、.bakの控えから復元してください。')}
  }
  return {storage,imports,lib:library(storage)};
 }
 const snapshot=state=>({profiles:state.lib.profiles(),decks:state.lib.profiles().flatMap(p=>state.lib.decks(p.id)),directory});
 async function writePlayer(state,profile){
  await mkdir(directory,{recursive:true});
  const target=path.join(directory,profile.id+'.json'),temp=target+'.'+randomUUID()+'.tmp';
  const data={version:1,profile,decks:state.lib.decks(profile.id),...(state.imports.has(profile.id)?{importKey:state.imports.get(profile.id)}:{})};
  // The old file remains intact if writing the new file fails. Keep one previous version.
  await writeFile(temp,JSON.stringify(data,null,2),{flag:'wx',flush:true});
  try{await copyFile(target,target+'.bak')}catch(e){if(e.code!=='ENOENT')throw e}
  await rename(temp,target);
 }
 function serial(fn){const job=queue.then(fn);queue=job.catch(()=>{});return job}
 return {
  directory,
  snapshot:()=>serial(async()=>snapshot(await read())),
  change:(operation,args={})=>serial(async()=>{
   const state=await read();let result,profile;
   if(operation==='createProfile'){result=state.lib.createProfile(args.name);profile=result}
   else if(operation==='save'){result=state.lib.save(args.profile,args.deck);profile=state.lib.profiles().find(p=>p.id===result.profile)}
   else if(operation==='importProfile'||operation==='migrate'){
    if(operation==='migrate'){
     if(typeof args.key!=='string'||args.key.length>300||!args.key)throw Error('移行元の情報がありません。');
     const found=state.lib.profiles().find(p=>state.imports.get(p.id)===args.key);
     if(found)return {result:found,...snapshot(state)};
    }
    result=state.lib.importProfile(args.data);profile=result;if(operation==='migrate')state.imports.set(profile.id,args.key);
   }else throw Error('未対応の保存操作です。');
   await writePlayer(state,profile);return {result,...snapshot(state)};
  })
 };
}
