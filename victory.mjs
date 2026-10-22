import {isTeam,teamOf,members} from './team.mjs';
import {deployment} from './public/unit-state.js';
import {cardStats} from './public/card-stats.js';
export function canClaimVictory(r,i){
 const team=isTeam(r)?teamOf(i):i,own=r.players[i],other=isTeam(r)?r.teams[1-team]:r.players[1-i];const attacking=isTeam(r)?members(r,team).map(j=>r.players[j]):[own];
 return !!(r.stage==='play'&&r.turn===team&&r.phase===3&&other&&!other.shields.length&&!other.base.length&&!r.players.some(p=>p.peek)&&attacking.some(p=>p.battle.some(c=>c.type==='ユニット'&&!c.attachedTo&&!c.rest&&deployment(c,p.battle,r.round)!=='召喚酔い'&&cardStats(c,p.battle).ap>0&&!/このユニットは[^。]*アタックできない/.test(c.effect||''))));
}
