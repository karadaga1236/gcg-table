import {fileURLToPath} from 'node:url';
import {createServer} from './server.mjs';
import {lobbyNetwork} from './lobby-network.mjs';
import {openBrowser} from './open-browser.mjs';
export async function startApp(){
 const rooms=new Map(),port=Number(process.env.PORT||8788),url=`http://127.0.0.1:${port}`,network=lobbyNetwork({rooms,port});
 const local=createServer({rooms,network});
 local.on('error',e=>{console.error(e.code==='EADDRINUSE'?'別の版が起動しています。前の黒い起動画面をCtrl+Cで終了してから起動してください。':e.message);process.exitCode=1});
 local.listen(port,'127.0.0.1',()=>{
  console.log(`\nGCG TABLE 04.5\n画面：${url}\n保存先：${fileURLToPath(new URL('./data/decks/',import.meta.url))}\n\n部屋の作成・参加はアプリ画面で選べます。\nこの黒い画面は開いたままにしてください。終了はCtrl+C。\n保存したデッキは残り、対戦中の進行は終了すると消えます。\n`);
  openBrowser(url);
 });
}
