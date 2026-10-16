import {deployment} from './public/unit-state.js';
import {cardStats} from './public/card-stats.js';
export function canClaimVictory(r,i){
 const own=r.players[i],other=r.players[1-i];
 return !!(r.stage==='play'&&r.turn===i&&r.phase===3&&other&&!other.shields.length&&!other.base.length&&!r.players.some(p=>p.peek)&&own.battle.some(c=>c.type==='ユニット'&&!c.attachedTo&&!c.rest&&deployment(c,own.battle,r.round)!=='召喚酔い'&&cardStats(c,own.battle).ap>0&&!/このユニットは[^。]*アタックできない/.test(c.effect||'')));
}
