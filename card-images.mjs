import {readFile,writeFile} from 'node:fs/promises';
export const validNumber=number=>typeof number==='string'&&/^[A-Z]{1,4}\d{0,3}-\d{1,4}$/.test(number);
const pending=new Map(),failed=new Map();
let active=0;const waiters=[];
async function acquire(){if(active<3){active++;return}await new Promise(resolve=>waiters.push(resolve))}
function release(){const next=waiters.shift();if(next)next();else active--}
export async function getCardImage(number,directory){
 if(!validNumber(number))throw Error('Invalid card number');
 const filename=new URL(`${number}.webp`,directory);
 try{return await readFile(filename)}catch(e){if(e.code!=='ENOENT')throw e}
 if(failed.has(number)&&Date.now()-failed.get(number)<60000)throw Error('Image unavailable');
 if(pending.has(number))return pending.get(number);
 if(pending.size>=100)throw Error('Image queue busy');
 const task=(async()=>{
  await acquire();try{
  // Fixed official origin and validated card number: never fetch arbitrary client URLs.
  const response=await fetch(`https://www.gundam-gcg.com/jp/images/cards/card/${number}.webp`,{signal:AbortSignal.timeout(12000),redirect:'error'});
  if(!response.ok)throw Error('Image unavailable');
  if(Number(response.headers.get('content-length'))>3000000)throw Error('Image too large');
  const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>3000000)throw Error('Image too large');chunks.push(chunk)}
  const bytes=Buffer.concat(chunks);if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP')throw Error('Unsupported image');
  await writeFile(filename,bytes);return bytes;
  }finally{release()}
 })();pending.set(number,task);
 try{return await task}catch(e){failed.set(number,Date.now());if(failed.size>200)failed.delete(failed.keys().next().value);throw e}finally{pending.delete(number)}
}
