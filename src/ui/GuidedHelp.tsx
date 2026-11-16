import { useState } from 'react';
import type { League } from '../engine';
import type { ManagementDestination } from './navigation';
import { Modal } from './common';
import { useUi } from './uiContext';
export type HelpMode='complete'|'discreet'|'off';
export interface UiPreferences { help:HelpMode; detailed:boolean; tour:number }
export function readPreferences():UiPreferences {
 try {const p=JSON.parse(localStorage.getItem('hoopsim.ui.v1') ?? '{}');return {help:['complete','discreet','off'].includes(p.help)?p.help:'complete',detailed:p.detailed===true,tour:Number.isInteger(p.tour)&&p.tour>=0&&p.tour<=5?p.tour:0};} catch{return {help:'complete',detailed:false,tour:0};}
}
export function taskActions(league:League):{label:string;description:string;destination:ManagementDestination}[] {
 return [
 {label:'Préparer mon prochain match',description:'Vérifiez le cinq et choisissez Jouer, Regarder ou Simuler.',destination:{area:'home',view:'preparation'}},
 {label:'Choisir mon cinq majeur',description:'Une proposition reste en brouillon jusqu’à Enregistrer.',destination:{area:'team',view:'rotation'}},
 {label:'Changer mes tactiques',description:'Une intention de jeu, puis les paramètres si nécessaire.',destination:{area:'team',view:'tactics'}},
 {label:'Recruter un joueur',description:league.phase==='playoffs'?'Consultation possible ; signatures fermées pendant les playoffs.':'Cherchez un joueur ou un agent libre.',destination:{area:'market',view:'players'}},
 {label:'Prolonger un contrat',description:'Vos joueurs en dernière année, sans prolongation déjà signée.',destination:{area:'market',view:'contracts',intent:'extensions'}},
 {label:'Proposer un transfert',description:'Choisissez les joueurs, vérifiez les conséquences, puis confirmez.',destination:{area:'market',view:'trades'}},
 {label:'Entraîner un joueur',description:'Le focus concerne les prochaines journées, sans gain immédiat.',destination:{area:'team',view:'development'}},
 {label:'Participer à la draft',description:league.offseason?'Reprenez l’étape actuelle de l’intersaison.':'Les prospects arrivent après les playoffs.',destination:{area:'season',view:'draft'}},
 {label:'Voir mes résultats',description:'Calendrier et feuilles de match enregistrées.',destination:{area:'season',view:'schedule'}},
 {label:'Voir les statistiques',description:'Comparez les performances par période.',destination:{area:'season',view:'stats'}},
 ];
}
export function TaskLauncher({league,onClose}:{league:League;onClose:()=>void}) {
 const ui=useUi(),[query,setQuery]=useState('');
 return <Modal title="Que voulez-vous faire ?" onClose={onClose}><label>Rechercher une action <input className="input" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="task-launcher">{taskActions(league).filter(a=>(a.label+' '+a.description).toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr'))).map(a=><article key={a.label}><button className="btn" onClick={()=>{ui.navigateTo(a.destination);onClose();}}>{a.label}</button><p className="small faint">{a.description}</p></article>)}</div></Modal>;
}
const STEPS:{title:string;text:string;destination:ManagementDestination}[]=[
 {title:'Bienvenue dans votre franchise',text:'Le prochain match et les décisions à examiner sont sur l’accueil. Explorer ne fait pas avancer la saison.',destination:{area:'home',view:'overview'}},
 {title:'Connaître vos joueurs',text:'Ouvrez une carte : note = synthèse, potentiel = marge de développement. Une fiche ne change aucun réglage.',destination:{area:'team',view:'roster'}},
 {title:'Composer votre cinq',text:'Choisissez cinq titulaires, puis enregistrez. Vous pouvez aussi conserver le cinq actuel.',destination:{area:'team',view:'rotation'}},
 {title:'Choisir une intention tactique',text:'Explorez les six systèmes sans changer le plan. Seul Enregistrer applique vos réglages.',destination:{area:'team',view:'tactics'}},
 {title:'Préparer votre match',text:'Jouer : vous contrôlez. Regarder : CPU contre CPU, coaching en pause. Simuler : résultat calculé directement.',destination:{area:'home',view:'preparation'}},
];
export function GuidedHelp({preferences,onChange,tab}:{preferences:UiPreferences;onChange:(p:UiPreferences)=>void;tab:string}) {
 const ui=useUi();if(preferences.help==='off')return null;
 const step=STEPS[preferences.tour];
 const contextual=tab==='marche'?'Recruter ajoute un joueur immédiatement ; prolonger engage un contrat pour la saison suivante. Vérifiez avant de signer.':tab==='tactiques'?'Le schéma est pédagogique. Le plan enregistré est utilisé dans les trois modes de match.':tab==='rotation'?'Modifier le cinq crée un brouillon. Enregistrez pour l’utiliser au prochain match.':tab==='developpement'||tab==='draft'?'Suivez l’étape actuelle. Les focus n’accordent aucun attribut au clic.':'Consulter les pages ne fait pas avancer la saison. Les décisions se confirment explicitement.';
 return <aside className="coach-help"><details open={preferences.help==='complete'}><summary>Conseil du coach • Pourquoi venir ici ?</summary><p>{contextual}</p>{step && <div><strong>Découverte {preferences.tour+1}/5 — {step.title}</strong><p>{step.text}</p><div className="row" style={{flexWrap:'wrap'}}><button className="btn btn-sm" onClick={()=>ui.navigateTo(step.destination)}>Découvrir cette étape</button><button className="btn btn-sm" onClick={()=>onChange({...preferences,tour:preferences.tour+1})}>{preferences.tour===4?'Terminer le guide':'Suivant / conserver mes choix'}</button><button className="btn btn-sm" onClick={()=>onChange({...preferences,tour:5})}>Ignorer le guide</button></div></div>}<button className="btn btn-sm" onClick={()=>onChange({...preferences,help:'discreet'})}>Aide discrète</button></details></aside>;
}
