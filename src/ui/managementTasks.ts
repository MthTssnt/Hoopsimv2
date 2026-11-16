import { playerName, type League } from '../engine';
import { validateGamePlan } from '../engine/gamePlan';
import type { ManagementDestination } from './navigation';
export interface ManagementTask { id:string; title:string; description:string; actionLabel:string; destination:ManagementDestination; category:'required'|'important'|'optional' }
export function managementTasks(league:League):ManagementTask[] {
 const team=league.teams.find(t=>t.id===league.userTeamId)!;
 const tasks:ManagementTask[]=[];
 const errors=team.gamePlan ? validateGamePlan(team.gamePlan,team,league.players):['Au moins cinq joueurs aptes sont nécessaires.'];
 if(errors.length)tasks.push({id:'rotation',category:'required',title:'Votre rotation doit être corrigée',description:errors.join(' '),actionLabel:'Corriger la rotation',destination:{area:'team',view:'rotation'}});
 const draft=league.offseason, pick=draft?.picks[draft.cursor];
 if(draft?.stage==='draft')tasks.push({id:`draft:${pick?.id}`,category:'required',title:pick?.ownerTeamId===team.id?'Votre choix de draft vous attend':'La draft est en cours',description:pick?.ownerTeamId===team.id?`Choix ${pick.number} : examinez les prospects avant de sélectionner un joueur.`:'Consultez les prospects, puis faites avancer les choix CPU.',actionLabel:'Reprendre la draft',destination:{area:'season',view:'draft'}});
 if(draft?.stage==='ready')tasks.push({id:'new-season',category:'required',title:'Préparer la prochaine saison',description:'Complétez votre effectif, puis lancez la saison depuis l’intersaison.',actionLabel:'Terminer l’intersaison',destination:{area:'season',view:'draft'}});
 for(const proposal of league.management?.proposals ?? [])tasks.push({id:`proposal:${proposal.id}`,category:'important',title:`Offre de ${league.teams.find(t=>t.id===proposal.offer.fromTeamId)?.name ?? 'franchise'}`,description:'Consultez les joueurs proposés avant d’accepter ou de refuser.',actionLabel:'Voir cette offre',destination:{area:'market',view:'trades',proposalId:proposal.id}});
 if(league.phase!=='playoffs' && draft?.stage!=='draft') for(const id of team.roster) {
  const p=league.players[id];if(p.contract.years!==1 || p.extension)continue;
  tasks.push({id:`extend:${id}`,category:league.phase==='offseason'?'important':'optional',title:`Contrat de ${playerName(p)}`,description:league.phase==='offseason'?'Dernière fenêtre avant la préparation de la draft. Sans accord, il devient agent libre.':'Dernière année de contrat. Vous pouvez négocier maintenant ou revenir plus tard.',actionLabel:`Prolonger ${playerName(p)}`,destination:{area:'market',view:'contracts',playerId:id,intent:'extensions'}});
 }
 if(league.phase==='offseason' && !draft)tasks.push({id:'prepare-draft',category:'important',title:'Préparer la draft',description:'Examinez d’abord vos prolongations. La préparation applique les évolutions et les départs avant de révéler les prospects.',actionLabel:'Voir les étapes de l’intersaison',destination:{area:'season',view:'draft'}});
 return tasks;
}
