import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {room,join,seat,view,act} from './engine.mjs';
import {getCardImage} from './card-images.mjs';
import {diskLibrary} from './disk-library.mjs';
import {relay} from './peer.mjs';
import {invitation} from './public/invitation.js';
export function createServer({rooms=new Map(),dataDirectory=new URL('./data/decks/',import.meta.url),localAccess=true,network=null}={}){
 const limits=new Map();const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'public');
 const saved=diskLibrary(dataDirectory instanceof URL?fileURLToPath(dataDirectory):dataDirectory);
 return http.createServer(async(req,res)=>{
  const send=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data))};
  try{
   const url=new URL(req.url,'http://localhost');
   const address=req.socket.localAddress?.replace(/^::ffff:/,''),remote=req.socket.remoteAddress?.replace(/^::ffff:/,'');
   const local=localAccess&&['127.0.0.1','::1'].includes(address)&&['127.0.0.1','::1'].includes(remote);
   const requestHost=new URL('http://'+req.headers.host);
   if(!([address,...(local?['localhost']:[])].includes(requestHost.hostname))||Number(requestHost.port||80)!==req.socket.localPort)return send(403,{error:'自分のPCの起動.cmdから開いてください。'});
   if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return send(403,{error:'この接続元からは操作できません。'});
   if(req.headers['sec-fetch-site']==='cross-site')return send(403,{error:'別のサイトからの操作はできません。'});
   res.setHeader('X-Robots-Tag','noindex, nofollow');
   if(url.pathname==='/peer-info'&&req.method==='GET')return send(200,{app:'GCG TABLE',protocol:8});
   if(url.pathname==='/api/local/connections'&&req.method==='GET'){
    if(!local)return send(403,{error:'自分のPCから操作してください。'});
    return send(200,{interfaces:network?.list()||[]});
   }
   if(url.pathname==='/api/local/library'){
    if(!local)return send(403,{error:'デッキの保存・読込は自分のPCで起動したアプリから行ってください。'});
    if(req.method==='GET')return send(200,await saved.snapshot());
    if(req.method!=='POST')return send(405,{error:'未対応の操作です。'});
    if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'JSONで送信してください。'});
    let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>2000000)return send(413,{error:'保存データが大きすぎます。2MB以内にしてください。'})}
    const a=JSON.parse(body);return send(200,await saved.change(a.operation,a.args));
   }
   if(url.pathname==='/healthz'&&req.method==='GET')return send(200,{ok:true});
   if(url.pathname==='/robots.txt'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'text/plain'});return res.end('User-agent: *\nDisallow: /\n')}
   const imageMatch=url.pathname.match(/^\/cards\/([A-Z]{1,4}\d{0,3}-\d{1,4})\.webp$/);
   if(imageMatch&&req.method==='GET'){
    try{const bytes=await getCardImage(imageMatch[1],new URL('./public/cards/',import.meta.url));res.writeHead(200,{'Content-Type':'image/webp','Cache-Control':'private, max-age=86400','X-Content-Type-Options':'nosniff'});return res.end(bytes)}catch{return send(404,{error:'画像を取得できません。ホストPCのネット接続やカード番号をご確認ください。'})}
   }
   if(url.pathname.startsWith('/api/')){
    if(!['GET','POST'].includes(req.method))return send(405,{error:'未対応のメソッドです。'});
    if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return send(403,{error:'この接続元からは操作できません。'});
    const ip=req.socket.remoteAddress,now=Date.now();let l=limits.get(ip);if(!l||now-l.at>60000){l={at:now,n:0};limits.set(ip,l)}if(++l.n>600)return send(429,{error:'操作が多すぎます。少し待ってください。'});
    let a={};if(req.method==='POST'){if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'JSONで送信してください。'});let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>40000)return send(413,{error:'入力が長すぎます。'})}a=JSON.parse(body||'{}')}
    if(req.headers['x-gcg-peer']){
     if(!local)return send(403,{error:'中継は自分のPCからのみ使用できます。'});
     const result=await relay(req.headers['x-gcg-peer'],req,url,a);res.writeHead(result.status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});return res.end(result.bytes);
    }
    if(url.pathname==='/api/create'&&req.method==='POST'){
     if(!local)return send(403,{error:'部屋の作成は自分のPCの画面から行ってください。'});
     if(a.mode!==undefined&&!['vpn','solo'].includes(a.mode))return send(400,{error:'部屋の種類が不正です。'});
     for(const [k,r]of rooms)if(now-r.updated>86400000)rooms.delete(k);
     if(rooms.size>=200)return send(503,{error:'ルーム数が上限に達しました。'});
     if(a.mode==='vpn'&&!network)return send(400,{error:'起動.cmdからアプリを起動してください。'});
     const r=room(a.name,a.bestOf??1);
     const peer=a.mode==='vpn'?await network.open(a.interface):`http://127.0.0.1:${req.socket.localPort}`;
     r.localOnly=a.mode==='solo';rooms.set(r.code,r);return send(200,{token:r.players[0].token,state:view(r,0),invite:invitation(peer,r.code)});
    }
    const code=String(a.code||url.searchParams.get('code')||'').toUpperCase();const r=rooms.get(code);if(!r)return send(404,{error:'ルームがありません。番号をご確認ください。サーバー再起動後は作り直しが必要です。'});
    if(r.localOnly&&!local)return send(403,{error:'この部屋は一人で確認するための部屋です。'});
    if(url.pathname==='/api/join'&&req.method==='POST'){join(r,a.name);return send(200,{token:r.players[1].token,state:view(r,1)})}
    const token=req.headers.authorization?.replace(/^Bearer /,'');const i=seat(r,token);
    if(url.pathname==='/api/state'&&req.method==='GET'){
     if(url.searchParams.get('since')===String(r.revision)){res.writeHead(204,{'Cache-Control':'no-store'});return res.end()}
     return send(200,view(r,i));
    }
    if(url.pathname==='/api/action'&&req.method==='POST'){const state=act(r,i,a);return send(200,{state,...a.type==='search'?{cards:[...r.players[i].deck].sort((a,b)=>a.name.localeCompare(b.name))}:{}})}
    return send(404,{error:'操作が見つかりません。'});
   }
   if(!local){res.writeHead(403,{'Content-Type':'text/plain; charset=utf-8'});return res.end('GCG TABLE 04.5：自分のPCで「起動.cmd」を実行し、「部屋に入る」にホストからの招待情報を貼り付けてください。')}
   const files={'/card-tags.js':'card-tags.js','/token-picker.js':'token-picker.js','/tokens.json':'tokens.json','/unit-state.js':'unit-state.js','/table-interaction.js':'table-interaction.js','/table-tools.js':'table-tools.js','/card-stats.js':'card-stats.js','/match-ui.js':'match-ui.js','/invitation.js':'invitation.js','/local-library.js':'local-library.js','/card-traits.js':'card-traits.js','/decks':'decks.html','/decks.js':'decks.js','/deck-store.js':'deck-store.js','/decks.css':'decks.css','/':'index.html','/app.js':'app.js','/style.css':'style.css','/catalog.json':'catalog.json','/sample-deck.txt':'sample-deck.txt','/card-back.svg':'card-back.svg','/resource-back.svg':'resource-back.svg'};const file=files[url.pathname];if(!file){res.writeHead(404);return res.end('Not found')}
   const data=await readFile(path.join(root,file));res.writeHead(200,{'Content-Type':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':file.endsWith('.json')?'application/json; charset=utf-8':file.endsWith('.txt')?'text/plain; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'self'; base-uri 'none'"});res.end(data);
  }catch(e){send(400,{error:e instanceof SyntaxError?'入力を読み取れませんでした。':e.message})}
 });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const host=process.env.HOST||'127.0.0.1',port=Number(process.env.PORT||8788);createServer().listen(port,host,()=>console.log(`GCG TABLE: http://${host}:${port}`));
}
