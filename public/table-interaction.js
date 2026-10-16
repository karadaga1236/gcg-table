// Resolve the drop against current state; never trust a stale drag or an opponent's area.
export function dragChoice(s,source,target){
 if(!s||s.stage!=='play'||!source||!target||source.player!==s.me||target.player!==s.me)return null;
 const p=s.players[s.me],c=p[source.zone]?.find?.(c=>c.id===source.id);if(!c)return null;
 if(target.zone==='battle'&&target.id&&['パイロット','コマンド'].includes(c.type)&&['hand','battle','resolving'].includes(source.zone)){
  const unit=p.battle.find(x=>x.id===target.id&&x.type==='ユニット');
  if(!unit||p.battle.some(x=>x.attachedTo===unit.id))return null;
  return {type:'attach',from:source.zone,id:c.id,target:unit.id};
 }
 let to=target.zone;
 if(to==='battle'&&source.zone==='hand'&&c.type==='コマンド')to='resolving';
 if(to==='battle'&&source.zone==='hand'&&c.type==='ベース')to='base';
 if(!['hand','battle','base','shields','trash','removed','resolving','resources','deck'].includes(to)||source.zone===to)return null;
 if(c.token&&!['battle','base','resources','removed'].includes(to))return null;
 if(p.peek&&(source.zone==='deck'||to==='deck'))return null;
 return {type:'move',from:source.zone,id:c.id,to,position:'top'};
}
export function bindDragging(getState,send,select,notify){
 let pending=null,ghost=null,hover=null,suppressUntil=0;
 const clear=()=>{if(ghost)suppressUntil=Date.now()+350;ghost?.remove();ghost=null;hover?.classList.remove('drag-over');hover=null;document.body.classList.remove('dragging');pending=null};
 function targetAt(x,y){const el=document.elementFromPoint(x,y),card=el?.closest('[data-card]'),zone=el?.closest('[data-drop]');return {el:card||zone,target:card?{id:card.dataset.card,zone:card.dataset.zone,player:Number(card.dataset.player)}:zone?{zone:zone.dataset.drop,player:Number(zone.dataset.owner)}:null}}
 document.addEventListener('pointerdown',e=>{
  if(e.button!==0||document.querySelector('dialog[open]'))return;const el=e.target.closest('[data-card]'),s=getState();
  if(!el||s?.stage!=='play'||Number(el.dataset.player)!==s.me)return;
  pending={id:el.dataset.card,zone:el.dataset.zone,player:Number(el.dataset.player),x:e.clientX,y:e.clientY,pointer:e.pointerId,revision:s.revision,el};
 });
 document.addEventListener('pointermove',e=>{
  if(!pending||e.pointerId!==pending.pointer)return;
  if(!ghost&&Math.hypot(e.clientX-pending.x,e.clientY-pending.y)<8)return;
  if(!ghost){ghost=pending.el.cloneNode(true);ghost.removeAttribute('data-card');ghost.className='drag-ghost';document.body.append(ghost);document.body.classList.add('dragging')}
  e.preventDefault();ghost.style.left=e.clientX+12+'px';ghost.style.top=e.clientY+12+'px';
  hover?.classList.remove('drag-over');const found=targetAt(e.clientX,e.clientY);hover=dragChoice(getState(),pending,found.target)?found.el:null;hover?.classList.add('drag-over');
 },{passive:false});
 document.addEventListener('pointerup',async e=>{
  if(!pending||e.pointerId!==pending.pointer)return;const source=pending,dragged=!!ghost,found=targetAt(e.clientX,e.clientY),s=getState();clear();if(!dragged)return;
  suppressUntil=Date.now()+350;e.preventDefault();
  if(source.revision!==s.revision){notify('ドラッグ中に盤面が更新されました。確認してもう一度操作してください。');return}
  const choice=dragChoice(s,source,found.target);if(!choice)return;
  const {type,...data}=choice;if(await send(type,data))select(null);
 });
 document.addEventListener('click',e=>{if(Date.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation()}},true);
 document.addEventListener('dragstart',e=>{if(e.target.closest('[data-card]'))e.preventDefault()});
 document.addEventListener('pointercancel',clear);window.addEventListener('blur',clear);document.addEventListener('keydown',e=>{if(e.key==='Escape')clear()});
 return {active:()=>!!ghost,cancel:clear};
}
