const $=s=>document.querySelector(s),E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function group(cards){const m=new Map();for(const c of cards){const old=m.get(c.number);if(old)old.count++;else m.set(c.number,{...c,count:1})}return [...m.values()].sort((a,b)=>a.number.localeCompare(b.number))}
function sideCards(cards,from,locked){return group(cards).map(c=>`<article class="swap-card"><button data-image="/cards/${E(c.number)}.webp" data-title="${E(c.name)}" aria-label="${E(c.name)}を拡大"><img src="/cards/${E(c.number)}.webp" alt="${E(c.name)}" loading="lazy"></button><strong>${E(c.name)}</strong><small>${E(c.number)} · ${c.count}枚</small><button data-swap="${E(c.number)}" data-from="${from}" ${locked?'disabled':''}>${from==='main'?'サイドへ ↓':'メインへ ↑'}</button></article>`).join('')||'<p class="fine">カードはありません。</p>'}
export function bindMatch(action,getState){
 $('#choose-first').onclick=()=>action('chooseFirst',{first:getState().format==='team'?getState().me%2:getState().me});
 $('#choose-second').onclick=()=>action('chooseFirst',{first:getState().format==='team'?1-getState().me%2:1-getState().me});
 $('#rematch-same').onclick=()=>action('rematch',{choice:'same'});$('#rematch-change').onclick=()=>action('rematch',{choice:'change'});
 $('#next-game').onclick=()=>action('nextGame');
 $('#side-ready').onclick=()=>action('sideReady',{ready:!getState().players[getState().me].sideReady});
 $('#start-next').onclick=()=>action('startNext');
 $('#sideboard-panel').addEventListener('click',e=>{const b=e.target.closest('[data-swap]');if(b)action('sideSwap',{from:b.dataset.from,number:b.dataset.swap})});
 $('#claim-victory').onclick=()=>{$('#dialogbody').innerHTML='<h2>直接攻撃による勝利を確定しますか？</h2><p>この攻撃が通り、相手の敗北条件を満たしたことを双方で確認してください。ブロックや防御効果、攻撃禁止などの判定は手動です。</p><div class="row"><button id="confirm-victory" class="primary">確認済み・勝利を確定</button><button id="cancel-victory">対戦に戻る</button></div>';$('#dialog').showModal();$('#cancel-victory').onclick=()=>$('#dialog').close();$('#confirm-victory').onclick=async()=>{if(await action('claimVictory'))$('#dialog').close()}};
 const confirmLoss=()=>{$('#dialogbody').innerHTML='<h2>このゲームの敗北を確定しますか？</h2><p class="fine">相手の勝ちとして記録します。チーム戦ではチーム全体の敗北です。BO3では次のゲームへ進めます。</p><div class="row"><button id="confirm-loss" class="danger">敗北を確定する</button><button id="cancel-loss">対戦に戻る</button></div>';$('#dialog').showModal();$('#cancel-loss').onclick=()=>$('#dialog').close();$('#confirm-loss').onclick=async()=>{if(await action('concede'))$('#dialog').close()}};$('#declare-loss').onclick=confirmLoss;$('#concede').onclick=confirmLoss;
}
export function renderMatch(s){
 const me=s.players[s.me],host=s.host>=0?s.host:0,team=s.format==='team',waiting=s.stage==='sideboard';
 $('#match-score').textContent=`BO${s.bestOf} · GAME ${s.game}　`+(team?s.score.map((score,t)=>'チーム'+(t===0?'A':'B')+' '+score+'勝').join(' / '):s.players.map((p,i)=>`${p.name} ${s.score[i]}勝`).join(' / '));
 $('#side-counts').textContent=s.players.map((p,i)=>`${p.name}：サイド${i===s.me?p.sideboard.length:p.sideboard}枚`).join(' / ');
 $('#first-choice').hidden=!['lobby','sideboard'].includes(s.stage)||s.firstChooser===null;
 $('#first-choice-text').textContent=(s.firstSelected===null?`${s.players[s.firstChooser]?.name||''}が先攻・後攻を選んでください。`:`${team?'チーム'+(s.firstSelected===0?'A':'B'):s.players[s.firstSelected]?.name}が先攻です。`)+(waiting?'（直前の敗者が選択）':'（ダイスの勝者が選択）');
 for(const id of ['choose-first','choose-second'])$('#'+id).disabled=s.firstChooser!==s.me;
 $('#game-result').hidden=s.stage!=='ended';
 $('#result-text').textContent=s.stage==='ended'?`ゲーム${s.game}：${team?'チーム'+(s.winner===0?'A':'B'):s.players[s.winner]?.name}の勝利。`+(s.matchWinner!==null?`対戦終了 — ${team?'チーム'+(s.matchWinner===0?'A':'B'):s.players[s.matchWinner]?.name}が${s.score[s.matchWinner]}勝。`:'続けてサイドボードを入れ替えられます。'):'';
 $('#next-game').hidden=s.me!==host||s.matchWinner!==null;
 $('#result-wait').textContent=s.matchWinner===null&&s.me!==host?'ホストが次のゲームの準備を始めるまでお待ちください。':'';
 $('#rematch-options').hidden=s.matchWinner===null;$('#rematch-status').textContent=s.stage==='ended'&&s.matchWinner!==null?s.players.map(p=>p.name+'：'+(p.rematchReady==='same'?'同じデッキで準備完了':p.rematchReady==='change'?'選び直して再戦':'選択待ち')).join(' / '):'';
 $('#declare-loss').hidden=s.stage!=='play';$('#claim-victory').hidden=!s.canClaimVictory;
 $('#sideboard-panel').hidden=!waiting;
 if(waiting){
  $('#side-status').textContent=s.players.map(p=>`${p.name}：${p.sideReady?'確定済み':'入れ替え中'}`).join(' / ');
  $('#swap-main-title').textContent=`メイン ${me.registeredDeck.length} / 50枚`;
  $('#swap-side-title').textContent=`サイドボード ${me.sideboard.length} / 10枚（未使用なら0枚）`;
  $('#swap-main').innerHTML=sideCards(me.registeredDeck,'main',me.sideReady);
  $('#swap-side').innerHTML=sideCards(me.sideboard,'side',me.sideReady);
  $('#side-ready').textContent=me.sideReady?'確定を解除して編集':'この構成で確定';
  $('#side-ready').disabled=!me.sideReady&&(me.registeredDeck.length!==50||![0,10].includes(me.sideboard.length));
  $('#start-next').hidden=s.me!==host;$('#start-next').disabled=!s.players.every(p=>p.sideReady)||s.firstSelected===null;
 }
}
