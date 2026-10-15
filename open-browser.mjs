import {spawn} from 'node:child_process';

export function openBrowser(url){
 // Only locally generated numeric IPv4 addresses and ports may enter cmd.exe.
 if(!/^http:\/\/(?:\d{1,3}\.){3}\d{1,3}:\d{1,5}$/.test(url))throw new Error('接続先の形式が不正です。');
 if(process.platform!=='win32'||process.env.GCG_NO_BROWSER==='1')return;
 const child=spawn('cmd.exe',['/d','/c','start','""',url],{windowsHide:true,stdio:'ignore'});
 child.on('error',()=>console.log(`ブラウザーで ${url} を開いてください。`));
 child.unref();
}
