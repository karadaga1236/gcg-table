import {invitation} from './invitation.js';
const $=s=>document.querySelector(s),E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function bindRoomBrowser(join){
 let busy=false,last=0,rooms=[];
 const search=async()=>{if(busy||Date.now()-last<1000)return;busy=true;last=Date.now();$('#find-rooms').disabled=true;$('#room-search-status').textContent='同じVPN内の部屋を探しています…';$('#found-rooms').innerHTML='';
 try{const r=await fetch('/api/local/discover'),data=await r.json();if(!r.ok)throw Error(data.error||'検索できませんでした。');rooms=data.rooms||[];$('#found-rooms').innerHTML=rooms.map((room,i)=>'<button class="found-room" data-room-index="'+i+'"><strong>'+E(room.name)+'の部屋</strong><span>BO'+room.bestOf+' · クリックして参加</span></button>').join('');$('#room-search-status').textContent=rooms.length?rooms.length+'件の部屋が見つかりました。':data.warning||'参加できる部屋が見つかりません。相手が部屋を作成済みか確認し、再検索してください。'}catch(e){$('#room-search-status').textContent=e.message}finally{busy=false;$('#find-rooms').disabled=false}};
 $('#find-rooms').onclick=search;$('#found-rooms').onclick=e=>{const b=e.target.closest('[data-room-index]');if(!b)return;const room=rooms[Number(b.dataset.roomIndex)];if(room)join(invitation(room.peer,room.code))};return search;
}
