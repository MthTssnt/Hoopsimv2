import {runFrontOffices} from '../src/engine/management/aiGm';
import {createNewGame,playerName} from '../src/engine';
import {evaluateContract} from '../src/engine/management/transactions';
import {expectedSalary} from '../src/engine/management/economy';
if(process.argv.includes('--proposal')) {
 let result=false;for(let seed=1;seed<=80;seed++){const league=createNewGame('bos',seed);league.day=28;runFrontOffices(league);if(league.management!.proposals.length){await new Promise<void>(resolve=>process.stdout.write(JSON.stringify({league,proposal:league.management!.proposals[0]}),()=>resolve()));result=true;break;}}
 if(!result)throw Error('No actual AI offer fixture');
 process.exit(0);
}
let found=false;
for(let seed=1;seed<=200 && !found;seed++) {
 const league=createNewGame('bos',seed),team=league.teams.find(t=>t.id==='bos')!;
 const eligible=team.roster.map(id=>league.players[id]).filter(p=>p.contract.years===1);
 const player=eligible.find(p=>evaluateContract(league,team.id,p.id,{salary:expectedSalary(p),years:p.age<27?2:1,promisedRole:'rolePlayer'}).accepted);
 if(player && eligible.length>=2){console.log(JSON.stringify({league,playerId:player.id,name:playerName(player)}));found=true;}
}
if(!found)throw Error('No real extension fixture');
