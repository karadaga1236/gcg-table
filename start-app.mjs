import {networkInterfaces} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline/promises';
import {stdin,stdout} from 'node:process';
import {createServer} from './server.mjs';
import {openBrowser} from './open-browser.mjs';
const listen=(server,port,address)=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,address,()=>{server.removeListener('error',reject);resolve()})});
export async function startApp(vpn=false){
 const rooms=new Map(),port=Number(process.env.PORT||8788),url=`http://127.0.0.1:${port}`,servers=[];
 try{
  const local=createServer({rooms});await listen(local,port,'127.0.0.1');servers.push(local);
  console.log(`\nGCG TABLE 04\n自分の画面：${url}\n保存先：${fileURLToPath(new URL('./data/decks/',import.meta.url))}\n`);
  if(vpn){
   const list=Object.entries(networkInterfaces()).flatMap(([name,ips])=>ips.filter(x=>x.family==='IPv4'&&!x.internal&&/Radmin|Hamachi/i.test(name)).map(x=>({name,address:x.address})));
   if(!list.length)console.log('VPN接続が見つかりません。デッキ編集は使えます。ホストになる場合はVPNを起動してから、このアプリを起動し直してください。');
   else{
    let chosen=list[0];if(list.length>1){list.forEach((x,i)=>console.log(`${i+1}. ${x.name} ${x.address}`));const rl=createInterface({input:stdin,output:stdout});const n=Number(await rl.question('接続の番号：'))-1;rl.close();chosen=list[n];if(!chosen)throw Error('接続の番号が不正です。')}
    const remote=createServer({rooms,localAccess:false});await listen(remote,port,chosen.address);servers.push(remote);
    console.log(`知人に伝える接続先：${chosen.address}:${port}\n自分の画面でルームを作り、合言葉も伝えてください。\n知人は自分のアプリの参加欄に接続先と合言葉を入力します。\n`);
   }
  }
  console.log('この黒い画面は開いたままにしてください。終了はCtrl+C。\n保存したデッキは残ります。対戦中の進行は終了すると消えます。\n');
  openBrowser(url);
 }catch(e){for(const s of servers)s.close();console.error(e.code==='EADDRINUSE'?`同じ接続先でアプリが起動しています。前の黒い起動画面でCtrl+Cを押して終了してから起動してください。対戦中は終了しないでください。`:e.message);process.exitCode=1}
}
