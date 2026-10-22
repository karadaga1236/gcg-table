import dgram from 'node:dgram';
import {randomBytes} from 'node:crypto';
import {peerAddress} from './peer.mjs';
export const DISCOVERY_PORT=8789,DISCOVERY_GROUP='239.255.71.67',DISCOVERY_PROTOCOL=10;
const ip=n=>n.split('.').reduce((v,b)=>(v<<8)|Number(b),0)>>>0;
function mask(n){return n.netmask||(/^(25|26|127)\./.test(n.address)?'255.0.0.0':'255.255.255.0')}
export function sameNetwork(address,n){return (ip(address)&ip(mask(n)))===(ip(n.address)&ip(mask(n)))}
export function broadcast(n){return ((ip(n.address)&ip(mask(n)))|~ip(mask(n)))>>>0}
const dotted=n=>[n>>>24,(n>>>16)&255,(n>>>8)&255,n&255].join('.');
function decode(bytes){if(bytes.length>20000)return null;try{return JSON.parse(bytes.toString())}catch{return null}}
export function discoveryService({rooms,port=DISCOVERY_PORT,targets,waitMs=1400}={}){
 const hosts=new Map(),throttle=new Map();let listener=null,starting=null;
 const listen=async()=>{
  if(starting)return starting;
  starting=new Promise((resolve,reject)=>{const s=dgram.createSocket({type:'udp4',reuseAddr:true});listener=s;
   s.once('error',reject);s.bind(port,'0.0.0.0',()=>{s.removeListener('error',reject);s.on('error',()=>{});resolve(s)});
   s.on('message',(bytes,remote)=>{const query=decode(bytes);if(query?.app!=='GCG TABLE'||query.kind!=='find'||query.protocol!==DISCOVERY_PROTOCOL||!/^\w{24}$/.test(query.nonce||''))return;
    const eligible=[...hosts.values()].filter(h=>sameNetwork(remote.address,h));if(!eligible.length)return;
    const key=remote.address+':'+remote.port,now=Date.now();if(now-(throttle.get(key)||0)<250)return;throttle.set(key,now);if(throttle.size>100)throttle.delete(throttle.keys().next().value);
    const result=[];for(const h of eligible)for(const r of rooms.values())if(r.listed!==false&&!r.localOnly&&r.stage==='lobby'&&r.players.length<(r.format==='team'?4:2)&&r.hostAddress===h.address&&now-r.updated<86400000)result.push({code:r.code,name:r.players.find(p=>p.token===r.hostToken)?.name||r.players[0].name,format:r.format||'duel',players:r.players.length,capacity:r.format==='team'?4:2,bestOf:r.bestOf,port:new URL(h.peer).port});
    if(result.length)s.send(Buffer.from(JSON.stringify({app:'GCG TABLE',kind:'rooms',protocol:DISCOVERY_PROTOCOL,nonce:query.nonce,rooms:result.slice(0,20)})),remote.port,remote.address,()=>{});
   });
  });return starting;
 };
 return {
  get port(){try{return listener?.address().port||port}catch{return port}},
  async advertise(n,peer){try{const s=await listen();hosts.set(n.address,{...n,peer});try{s.addMembership(DISCOVERY_GROUP,n.address)}catch{}return true}catch{return false}},
  async find(interfaces){
   const nonce=randomBytes(12).toString('hex'),found=new Map(),errors=[],sockets=[];
   await Promise.all(interfaces.map(n=>new Promise(resolve=>{
    const s=dgram.createSocket('udp4');sockets.push(s);let ended=false;
    const finish=()=>{if(ended)return;ended=true;try{s.close()}catch{}resolve()};const timer=setTimeout(finish,waitMs);
    s.on('error',()=>{errors.push(n.name);clearTimeout(timer);finish()});
    s.on('message',(bytes,remote)=>{const reply=decode(bytes);if(reply?.app!=='GCG TABLE'||reply.kind!=='rooms'||reply.protocol!==DISCOVERY_PROTOCOL||reply.nonce!==nonce||!Array.isArray(reply.rooms)||!sameNetwork(remote.address,n))return;
     for(const r of reply.rooms.slice(0,20)){if(!/^[A-F0-9]{12}$/.test(r.code)||typeof r.name!=='string'||r.name.length>24||![1,3].includes(r.bestOf)||!/^\d{4,5}$/.test(String(r.port)))continue;try{const peer=peerAddress(remote.address+':'+r.port);found.set(peer+'/'+r.code,{peer,code:r.code,name:r.name,bestOf:r.bestOf,format:r.format==='team'?'team':'duel',players:r.players,capacity:r.capacity})}catch{}}
    });
    s.bind(0,n.address,()=>{s.setBroadcast(true);try{s.setMulticastInterface(n.address);s.setMulticastTTL(1)}catch{}const bytes=Buffer.from(JSON.stringify({app:'GCG TABLE',kind:'find',protocol:DISCOVERY_PROTOCOL,nonce}));for(const target of targets||[DISCOVERY_GROUP,dotted(broadcast(n)),'255.255.255.255'])s.send(bytes,port,target,()=>{})});
   })));
   return {rooms:[...found.values()].slice(0,100),warning:!interfaces.length?'VPNが見つかりません。接続してから再検索してください。':errors.length?'問い合わせを送信できない接続があります。見つからない場合は招待情報を使ってください。':''};
  },
  async close(){if(listener){try{await new Promise(r=>listener.close(r))}catch{}}hosts.clear();listener=null;starting=null}
 };
}
