import {networkInterfaces} from 'node:os';
import {createServer} from './server.mjs';
export function vpnInterfaces(){return Object.entries(networkInterfaces()).flatMap(([name,ips])=>ips.filter(x=>x.family==='IPv4'&&!x.internal&&/Radmin|Hamachi/i.test(name)).map(x=>({name,address:x.address})))}
export function lobbyNetwork({rooms,port=8788,interfaces=vpnInterfaces}){
 const listeners=new Map();
 return {
  list:()=>interfaces(),
  async open(address){
   const choices=interfaces(),chosen=choices.find(x=>x.address===address)||(choices.length===1&&!address?choices[0]:null);
   if(!chosen)throw Error(choices.length?'使うVPN接続を選んでください。':'VPNが見つかりません。Radmin VPNかHamachiを接続し、「接続を再確認」を押してください。');
   if(!listeners.has(chosen.address)){
    const server=createServer({rooms,localAccess:false});
    const pending=new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,chosen.address,()=>resolve({server,peer:`http://${chosen.address}:${server.address().port}`}))});
    listeners.set(chosen.address,pending);
    pending.catch(()=>listeners.delete(chosen.address));
   }
   try{return (await listeners.get(chosen.address)).peer}catch(e){throw Error(e.code==='EADDRINUSE'?'この接続先で別の版が起動しています。前のアプリを終了してから試してください。':'部屋の受付を開始できません。VPNの接続を確認してください。')}
  },
  async close(){for(const p of listeners.values()){try{const {server}=await p;await new Promise(r=>server.close(r))}catch{}}listeners.clear()}
 };
}
