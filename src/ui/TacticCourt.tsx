import { useId, useState } from 'react';
import { PLAYS, type PlayId } from '../engine/coaching/tactics';
import type { GamePlan } from '../engine/gamePlan';
type Point=[number,number];
// Feet × 10, 50 × 47 half court. Basket at 5.25 ft from baseline.
const LAYOUTS:Record<PlayId,Point[]>={
 default:[[250,350],[65,280],[435,280],[150,165],[350,165]],
 fiveOut:[[250,355],[65,315],[435,315],[15,65],[485,65]],
 horns:[[250,350],[15,65],[485,65],[170,190],[330,190]],
 highPickRoll:[[215,330],[15,65],[485,65],[430,300],[255,285]],
 postEntry:[[345,340],[15,65],[485,265],[130,290],[310,110]],
 isolation:[[380,295],[15,65],[30,330],[160,330],[155,110]],
};
const IDEAS:Record<PlayId,{pass?:string;run?:string;screen?:Point;text:string}>={
 default:{pass:'M250 350 L65 280 M250 350 L350 165',text:'1 lit le placement : passe vers une aile ou un intérieur, sans séquence imposée.'},
 fiveOut:{run:'M65 315 L155 190',pass:'M250 355 L435 315',text:'Les cinq joueurs sont au-delà des trois points. 2 peut pénétrer ; 1 peut aussi renverser vers 3.'},
 horns:{screen:[218,255],run:'M170 190 L210 110 M250 350 L300 260',text:'4 et 5 occupent les coudes. Le porteur utilise un côté, un intérieur coupe vers le cercle.'},
 highPickRoll:{screen:[233,300],run:'M215 330 L310 220 M255 285 L275 115',pass:'M310 220 L485 65',text:'5 pose un écran haut pour 1, puis plonge vers le cercle. Le porteur peut attaquer ou ressortir.'},
 postEntry:{pass:'M345 340 L310 110 M310 110 L485 265',text:'1 sert 5 près du panier ; 5 peut finir ou ressortir vers le soutien 3.'},
 isolation:{run:'M380 295 L300 140',text:'1 dispose du côté droit dégagé. Les quatre partenaires s’écartent de son couloir de création.'},
};
export function TacticCourt({activePlan}:{activePlan?:GamePlan}) {
 const [play,setPlay]=useState<PlayId>('fiveOut'),[idea,setIdea]=useState(false);const label=useId(),arrow=useId();
 const active=activePlan?.playbook.find(p=>p.playId===play);
 return <figure className="tactic-board basketball-board"><div className="court-picker"><h3>Comprendre un système</h3><label>Système pédagogique <select aria-label="Schéma pédagogique" value={play} onChange={e=>setPlay(e.target.value as PlayId)}>{Object.entries(PLAYS).map(([id,p])=><option key={id} value={id}>{p.name}</option>)}</select></label><div className="system-cards">{Object.entries(PLAYS).map(([id,p])=><button className="btn btn-sm" key={id} aria-pressed={play===id} onClick={()=>setPlay(id as PlayId)}>{p.name}<small>{activePlan?.playbook.find(x=>x.playId===id)?.weight ? `Plan enregistré : poids ${activePlan.playbook.find(x=>x.playId===id)!.weight}` : 'Explorer'}</small></button>)}</div></div>
 <div><div className="toolbar"><button className="btn btn-sm" aria-pressed={!idea} onClick={()=>setIdea(false)}>Placement initial</button><button className="btn btn-sm" aria-pressed={idea} onClick={()=>setIdea(true)}>Idée du système</button></div>
 <svg viewBox="-10 -10 520 490" className="half-court" role="img" aria-labelledby={label}>
 <title id={label}>Demi-terrain, panier en haut, attaque depuis le bas. {PLAYS[play].name}. {IDEAS[play].text}</title>
 <defs><pattern id={`${arrow}-wood`} width="100" height="40" patternUnits="userSpaceOnUse"><rect width="100" height="40" fill="#c78a52"/><path d="M0 0H100V40 M50 0V20 M0 20H100" stroke="#b67a46" fill="none"/></pattern><marker id={arrow} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10Z" fill="context-stroke"/></marker></defs>
 <rect x="0" y="0" width="500" height="470" fill={`url(#${arrow}-wood)`}/>
 <g fill="none" stroke="#fff9ec" strokeWidth="3">
 <path data-court-mark="boundaries" d="M1 1H499V469H1Z"/>
 <path data-court-mark="lane" d="M170 0V190H330V0"/>
 <path data-court-mark="free-throw" d="M170 190H330 M190 190 A60 60 0 0 0 310 190"/>
 <path d="M190 190 A60 60 0 0 1 310 190" strokeDasharray="8 6"/>
 <path data-court-mark="three-point" d="M30 0V142 A237.5 237.5 0 0 0 470 142V0"/>
 <path data-court-mark="restricted" d="M210 52.5 A40 40 0 0 0 290 52.5"/>
 <path data-court-mark="halfway" d="M190 470 A60 60 0 0 1 310 470"/>
 </g>
 <path data-court-mark="backboard" d="M220 40H280" stroke="#152840" strokeWidth="6"/><circle data-court-mark="rim" cx="250" cy="52.5" r="7.5" fill="none" stroke="#a52f25" strokeWidth="4"/>
 {idea && <g fill="none" strokeWidth="4">{IDEAS[play].pass && <path d={IDEAS[play].pass} stroke="#152840" strokeDasharray="8 6" markerEnd={`url(#${arrow})`}/>} {IDEAS[play].run && <path d={IDEAS[play].run} stroke="#174a9b" markerEnd={`url(#${arrow})`}/>} {IDEAS[play].screen && <path d={`M${IDEAS[play].screen![0]-14} ${IDEAS[play].screen![1]}h28`} stroke="#a52f25" strokeWidth="8"/>}</g>}
 {LAYOUTS[play].map(([x,y],i)=><g key={i} data-player={i+1}><rect x={x-13} y={y-13} width="26" height="26" fill={i===0?'#173b73':'#fff9ec'} stroke="#152840" strokeWidth="2"/><text x={x} y={y+6} textAnchor="middle" fill={i===0?'#fff9ec':'#152840'} fontSize="18" fontWeight="bold">{i+1}</text>{i===0 && <rect x={x+12} y={y+6} width="8" height="8" fill="#f47928" stroke="#152840"/>}</g>)}
 </svg><p className="small">↑ Attaque vers le panier • 1 : porteur / petit carré orange : ballon • trait bleu : course / coupe • pointillé : passe • barre rouge : écran.</p></div>
 <figcaption><strong>{PLAYS[play].name}</strong> · {PLAYS[play].description}<p>{IDEAS[play].text}</p><p className="small faint">{active?.weight ? `Poids relatif dans le plan enregistré : ${active.weight}.` : 'Ce système n’a pas de poids actif dans le plan enregistré.'} Schéma pédagogique, sans effet sur votre plan et sans prévisualisation du match.</p></figcaption></figure>;
}
