import {isIP} from 'node:net';
export function peerAddress(input){
 const s=String(input||'').trim();let u;try{u=new URL(s.includes('://')?s:'http://'+s)}catch{throw Error('接続先を「26.x.x.x:8788」のように入力してください。')}
 if(u.protocol!=='http:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash||isIP(u.hostname)!==4)throw Error('VPNのIPv4アドレスとポート番号を入力してください。');
 const explicitPort=s.replace(/^http:\/\//,'').split('/')[0].match(/:(\d+)$/)?.[1];
 const [a,b]=u.hostname.split('.').map(Number),port=Number(explicitPort||u.port||8788);
 if(!((a===26||a===25||a===10)||(a===192&&b===168)||(a===172&&b>=16&&b<=31)||u.hostname==='127.0.0.1')||port<1024||port>65535)throw Error('Radmin VPN・Hamachi・LANのアドレスを入力してください。');
 return `http://${u.hostname}:${port}`;
}
async function bounded(response){const chunks=[];let size=0;for await(const b of response.body){size+=b.length;if(size>2000000)throw Error('対戦先からの応答が大きすぎます。');chunks.push(b)}return Buffer.concat(chunks)}
export async function relay(peer,req,url,body){
 const destination=peerAddress(peer);
 if(!['/api/join','/api/state','/api/action'].includes(url.pathname))throw Error('この操作は他のPCに送信できません。');
 if((url.pathname==='/api/state'&&req.method!=='GET')||(url.pathname!=='/api/state'&&req.method!=='POST'))throw Error('未対応の通信です。');
 try{
  const info=await fetch(destination+'/peer-info',{redirect:'error',signal:AbortSignal.timeout(5000)});
  if(!info.ok)throw Error('version');const version=JSON.parse((await bounded(info)).toString());if(version.protocol!==9||version.app!=='GCG TABLE')throw Error('version');
  const target=new URL(url.pathname,destination);if(url.pathname==='/api/state'){for(const key of ['code','since'])if(url.searchParams.has(key))target.searchParams.set(key,url.searchParams.get(key))}
  const response=await fetch(target,{method:req.method,headers:{'Content-Type':'application/json',...(req.headers.authorization?{Authorization:req.headers.authorization}:{})},...(req.method==='POST'?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(8000)});
  return {status:response.status,bytes:response.status===204?Buffer.alloc(0):await bounded(response)};
 }catch(e){if(e.message==='version')throw Error('相手もGCG TABLE 04.7を起動してください。接続先が違う可能性もあります。');throw Error('相手のアプリに接続できません。VPN接続・相手の起動状態・接続先を確認してください。')}
}
