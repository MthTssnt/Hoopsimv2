/** Seeded real league for the browser market scenario; no DOM or save modifications. */
import {createNewGame,playerName} from '../src/engine/index.ts';
import {evaluateTrade} from '../src/engine/management/transactions.ts';
import {tradeStatus} from '../src/engine/management/economy.ts';
const league=createNewGame('bos',31),team=league.teams.find(t=>t.id==='bos')!;
type FixtureOffer = { offer: Parameters<typeof evaluateTrade>[1]; out: string; incoming: string; other: string };
let accepted: FixtureOffer | null = null, rejected: FixtureOffer | null = null;
for(const other of league.teams.filter(t=>t.id!==team.id))for(const out of team.roster)for(const inc of other.roster){
 const offer={fromTeamId:team.id,toTeamId:other.id,outgoingIds:[out],incomingIds:[inc]};
 const decision=evaluateTrade(league,offer);
 const descriptor={offer,out:playerName(league.players[out]),incoming:playerName(league.players[inc]),other:other.abbr};
 if(decision.accepted&&!accepted)accepted=descriptor;
 if(!decision.accepted&&tradeStatus(league,league.players[inc])==='normal'&&decision.reasons.some(r=>r.includes('refuse'))&&!rejected)rejected=descriptor;
}
if(!accepted||!rejected)throw Error('Missing fixtures');
console.log(JSON.stringify({league,accepted,rejected}));
