const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const teammate=(s,j)=>s.format==='team'&&j%2===s.me%2;
export function teamCard(s,selection){return selection?.zone==='teamBase'?s.teams?.[selection.player]?.base.find(c=>c.id===selection.id):selection?.zone==='teamShield'?s.teams?.[selection.player]?.shields.find(c=>c.id===selection.id):null}
export function teamBoards(s,board,cardHTML,slot){
 const own=s.me%2;
 return [1-own,own].map(t=>{
  const team=s.teams[t],ids=s.players.map((_,j)=>j).filter(j=>j%2===t),units=ids.reduce((n,j)=>n+s.players[j].battle.filter(c=>c.type==='ユニット'&&!c.attachedTo).length,0);
  const ordered=ids.filter(j=>j!==s.me).concat(ids.includes(s.me)?[s.me]:[]);
  return `<section class="team-table ${t===own?'allied-team':'enemy-team'}"><div class="team-heading"><h2>チーム${t===0?'A':'B'} · ${t===own?'自分と味方':'相手チーム'}</h2><span>${s.stage==='play'&&s.turn===t?'● TURN '+s.round+' · ':''}ユニット ${units} / 6</span></div><div class="shared-area"><div class="shared-base"><strong>共有ベース</strong>${team.base.map(c=>slot(c,'teamBase',t,s.players[c.owner])).join('')||'<small>ベースなし</small>'}</div><div class="shared-shields"><strong>共有シールド ${team.shields.length}枚</strong><div class="shield-cards">${team.shields.map((c,n)=>cardHTML(c,'teamShield',t,n)).join('')}</div></div>${t===own&&s.stage==='play'?`<div class="shared-controls"><button data-team-shield="resolving" ${team.shields.length?'':'disabled'}>一番上を公開・バースト確認</button><button data-team-shield="hand" ${team.shields.length?'':'disabled'}>一番上を持ち主の手札へ</button><small>シールドは左端が一番上。公開後は持ち主が処理します。</small></div>`:''}</div><div class="team-players">${ordered.map(j=>board(s.players[j],j)).join('')}</div></section>`;
 }).join('');
}
export function renderTeamLobby(s){
 const el=document.querySelector('#team-lobby');el.hidden=s.format!=='team'||!['lobby','sideboard'].includes(s.stage);if(el.hidden)return;
 const host=s.host>=0?s.host:0,labels=['A · リーダー（右席）','B · リーダー（右席）','A · メンバー（左席）','B · メンバー（左席）'];
 el.innerHTML='<h2>2対2 · チーム編成</h2><p class="fine">入室順でAリーダー → Bリーダー → Aメンバー → Bメンバー。ホストが準備中に席を入れ替えられます。味方の手札はお互いに表示されます。カード操作と支払いは各自、フェイズ進行は各チームのリーダーが担当します。</p><div class="team-roster">'+labels.map((label,j)=>'<div><strong>'+label+'</strong><span>'+E(s.players[j]?.name||'入室待ち')+(j===s.me?'（自分）':'')+'</span><small>'+(!s.players[j]?'—':s.players[j].deckLoaded?'デッキ登録済み':'デッキ未登録')+'</small></div>').join('')+'</div>'+(s.stage==='lobby'&&s.me===host?'<div class="row wrap seat-controls"><label>席1<select id="seat-left">'+s.players.map((p,j)=>'<option value="'+j+'">'+E(labels[j]+'：'+p.name)+'</option>').join('')+'</select></label><label>席2<select id="seat-right">'+s.players.map((p,j)=>'<option value="'+j+'" '+(j===2?'selected':'')+'>'+E(labels[j]+'：'+p.name)+'</option>').join('')+'</select></label><button id="swap-seats">席を入れ替える</button></div>':'')+(s.deckIssues?.length?'<div class="team-deck-issues" role="status">'+s.deckIssues.map(x=>'<p>'+E(x)+'</p>').join('')+'</div>':'<p class="fine">デッキ登録後に、チーム内の色の重複と禁止制限を確認します（2026年9月25日版）。</p>');
}
export function teamInspector(s,selection){
 const c=teamCard(s,selection);if(!c)return null;const base=selection.zone==='teamBase',own=selection.player===s.me%2;
 let html='<h2>'+E(base?c.name:'共有シールド')+'</h2><p class="fine">持ち主：'+E(s.players[c.owner]?.name)+'</p><img class="team-inspect-art" src="'+(base&&c.number?'/cards/'+E(c.number)+'.webp':'/card-back.svg')+'" alt="'+E(base?c.name:'非公開のシールド')+'">';
 if(base)html+='<p>ダメージ '+c.damage+' / HP '+(typeof c.hp==='number'?Math.max(0,c.hp+(c.modifier?.hp||0)):'—')+'</p><p class="fine">'+E(c.modifier?.note||'')+'</p>';
 if(own&&s.stage==='play'){
  if(!base){if(s.teams[selection.player].shields[0]?.id===c.id)html+='<div class="quick-actions"><button data-team-shield="resolving">公開・バースト確認</button><button data-team-shield="hand">持ち主の手札へ</button></div>';else html+='<p class="fine">一番上のシールドから処理してください。</p>'}
  else html+='<div class="quick-actions"><button data-team-base="rest">'+(c.rest?'アクティブに戻す':'レストにする')+'</button><button data-team-base="damage" data-delta="1">ダメージ ＋1</button><button data-team-base="damage" data-delta="-1">ダメージ −1</button><button data-team-base="move" data-to="'+(c.token?'removed':'trash')+'">'+(c.token?'EXベースを除外':'トラッシュへ')+'</button>'+(!c.token?'<button data-team-base="move" data-to="hand">持ち主の手札へ</button><button data-team-base="move" data-to="deck">持ち主の山札上へ</button>':'')+'</div><details><summary>共有ベースの補正・効果メモ</summary><label>AP補正<input id="team-base-ap" type="number" min="-99" max="99" value="'+(c.modifier?.ap||0)+'"></label><label>HP補正<input id="team-base-hp" type="number" min="-99" max="99" value="'+(c.modifier?.hp||0)+'"></label><label>メモ<input id="team-base-note" maxlength="140" value="'+E(c.modifier?.note||'')+'"></label><label>期限<select id="team-base-duration"><option value="turn">このターンまで</option><option value="manual" '+(c.modifier?.duration==='manual'?'selected':'')+'>手動で解除</option></select></label><label class="checkline"><input id="team-base-skip" type="checkbox" '+(c.skipRefresh?'checked':'')+'>次のスタートでアクティブにしない</label><button data-team-base="modifier">補正を反映</button></details>';
 }else html+='<p class="fine">閲覧のみ</p>';return html;
}
export function handleTeamClick(e,s,selection,send){
 const focus=e.target.closest('[data-team-focus]');if(focus){focusTeam(focus.dataset.teamFocus);return true}
 const swap=e.target.closest('#swap-seats');if(swap){send('swapSeats',{left:Number(document.querySelector('#seat-left').value),right:Number(document.querySelector('#seat-right').value)});return true}
 const shield=e.target.closest('[data-team-shield]');if(shield){const c=s.teams[s.me%2].shields[0];if(c)send('teamShield',{id:c.id,to:shield.dataset.teamShield});return true}
 const base=e.target.closest('[data-team-base]');if(base&&selection?.zone==='teamBase'){
  const data={id:selection.id,operation:base.dataset.teamBase,delta:Number(base.dataset.delta),to:base.dataset.to};
  if(data.operation==='modifier')Object.assign(data,{ap:Number(document.querySelector('#team-base-ap').value),hp:Number(document.querySelector('#team-base-hp').value),note:document.querySelector('#team-base-note').value,duration:document.querySelector('#team-base-duration').value,skipRefresh:document.querySelector('#team-base-skip').checked});send('teamBase',data);return true;
 }return false;
}
export function focusTeam(which){const container=document.querySelector('#boards'),team=container.querySelector(which==='own'?'.allied-team':'.enemy-team');if(team)container.scrollTop+=team.getBoundingClientRect().top-container.getBoundingClientRect().top-7}
function choose(html,collect){return new Promise(resolve=>{const d=document.querySelector('#dialog');let settled=false;const finish=value=>{if(settled)return;settled=true;d.removeEventListener('close',cancel);d.close();resolve(value)};const cancel=()=>finish(null);d.innerHTML='<form method="dialog"><button class="close" aria-label="閉じる">×</button></form><div id="dialogbody">'+html+'<div class="row"><button id="team-confirm" class="primary">選択して続ける</button><button id="team-cancel">取り消す</button></div><p id="team-choice-error" role="status"></p></div>';d.addEventListener('close',cancel);document.querySelector('#team-cancel').onclick=cancel;document.querySelector('#team-confirm').onclick=()=>{const value=collect();if(value!==null)finish(value)};if(!d.open)d.showModal()})}
export async function prepareTeamAction(s,type,data){
 if(s.format!=='team')return data;
 const p=s.players[s.me],all=s.players.flatMap((p,j)=>j%2===s.me%2?p.battle.filter(c=>c.type==='ユニット'&&!c.attachedTo).map(c=>({c,j})):[]);
 let entering=[];
 if(['move','batchMove'].includes(type)&&data.to==='battle'&&data.from!=='battle')entering=p[data.from]?.filter(c=>type==='move'?c.id===data.id:data.ids?.includes(c.id))||[];
 if(type==='finishPeek'&&data.to==='battle')entering=p.peek?.cards.filter(c=>data.ids.includes(c.id))||[];
 const count=type==='createToken'?data.count:type==='token'&&data.to==='battle'?1:entering.filter(c=>c.type==='ユニット').length,overflow=Math.max(0,all.length+count-6);
 if(overflow){
  if(overflow>all.length){throw Error('一度に配備できるユニットはチームで6体までです。')}
  const result=await choose('<h2>チームのユニットを入れ替える</h2><p>合計6体を超えるため、先に場から移すユニットを'+overflow+'体選んでください。持ち主のトラッシュへ移し、トークンは除外します。破壊としては扱いません。</p><div class="replacement-grid">'+all.map(({c,j},n)=>'<label><input type="checkbox" data-replace="'+n+'"><img src="/cards/'+E(c.number)+'.webp" alt=""><span>'+E(s.players[j].name)+' · '+E(c.name)+'</span></label>').join('')+'</div>',()=>{const chosen=[...document.querySelectorAll('[data-replace]:checked')];if(chosen.length!==overflow){document.querySelector('#team-choice-error').textContent=overflow+'体選んでください。';return null}return chosen.map(x=>({player:all[Number(x.dataset.replace)].j,id:all[Number(x.dataset.replace)].c.id}))});
  if(!result)return null;data={...data,replaceUnits:result};
 }
 const toBase=['move','batchMove','finishPeek'].includes(type)&&data.to==='base'||type==='token'&&data.to==='base';
 const old=s.teams[s.me%2].base[0];if(toBase&&old){const result=await choose('<h2>共有ベースを入れ替える</h2><p>'+E(old.name)+'を持ち主の'+(old.token?'除外':'トラッシュ')+'へ移し、新しいベースを配備します。破壊としては扱いません。</p>',()=>true);if(!result)return null;data={...data,replaceBase:old.id}}
 return data;
}
