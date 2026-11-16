import {describe,it,expect} from 'vitest';
import {createNewGame} from '../engine';
import {managementTasks} from './managementTasks';
import {destinationTab} from './navigation';
describe('guided decision routes',()=>{
 it('targets a player and removes a signed extension without mutating the league',()=>{
  const league=createNewGame('bos',1),team=league.teams.find(t=>t.id==='bos')!,p=league.players[team.roster[0]];p.contract.years=1;
  const before=JSON.stringify(league);const task=managementTasks(league).find(t=>t.id===`extend:${p.id}`)!;
  expect(task.destination).toEqual({area:'market',view:'contracts',playerId:p.id,intent:'extensions'});expect(JSON.stringify(league)).toBe(before);
  p.extension={salary:10,years:1,promisedRole:'rolePlayer'};expect(managementTasks(league).some(t=>t.id===task.id)).toBe(false);
 });
 it('does not invent an eligible extension or offer when none exists',()=>{
  const league=createNewGame('bos',31);for(const id of league.teams.find(t=>t.id==='bos')!.roster)league.players[id].contract.years=2;
  expect(managementTasks(league)).toEqual([]);
 });
 it('does not offer a signature during playoffs',()=>{
  const league=createNewGame('bos',1);league.phase='playoffs';expect(managementTasks(league).some(t=>t.id.startsWith('extend:'))).toBe(false);
 });
 it('prioritizes an invalid rotation and uses the existing validator',()=>{
  const league=createNewGame('bos',1);const team=league.teams.find(t=>t.id==='bos')!;team.gamePlan!.rotation.starterIds[0]='missing';
  expect(managementTasks(league)[0]).toMatchObject({id:'rotation',category:'required',destination:{area:'team',view:'rotation'}});
 });
 it('resolves deep destinations without depending on current tab',()=>{
  expect(destinationTab({area:'market',view:'contracts',playerId:'p1'})).toBe('marche');
  expect(destinationTab({area:'market',view:'trades',proposalId:'offer1'})).toBe('marche');
  expect(destinationTab({area:'season',view:'draft'})).toBe('draft');
 });
});
