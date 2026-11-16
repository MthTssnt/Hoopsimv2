import referenceSpriteUrl from '../../assets/players/clubhouse/reference/sprite-45.png';
import referencePortraitUrl from '../../assets/players/clubhouse/reference/portrait-45.png';
import {useEffect,useRef,useState} from 'react';
import {APPEARANCE_OPTIONS,appearanceIdentity,appearanceKey,normalizeAppearance,type PlayerAppearance} from '../../engine/appearance';
import type {Player} from '../../engine/types';
import {appearanceFor} from '../../match/render/sprites/appearance';
import {paintClubhouse} from '../../match/render/sprites/clubhouseArt';
import {clubhouseContact,CLUBHOUSE_BALL_RADIUS} from '../../match/render/sprites/clubhouseGeometry';
import {FRAME} from '../../match/render/sprites/views';
import {MOTIONS,dribbleBallAt,type MotionId} from '../../match/render/sprites/motion';
import bodyUrl from '../../assets/players/clubhouse/body.png';
import headUrl from '../../assets/players/clubhouse/heads.png';
import {store} from '../../state/store';
import {useDraftGuard} from '../useDraftGuard';
import {useUi} from '../uiContext';
import {ActionFeedback} from '../ActionFeedback';
import {PlayerPortrait} from './PlayerPortrait';
const LABELS:Record<keyof typeof APPEARANCE_OPTIONS,string[]>={
 skin:['Porcelaine','Sable','Caramel','Cuivré','Brun','Ébène'],face:['Naturel','Fin','Carré'],
 hair:['Mèches courtes','Coupe rase','Boucles','Mèche latérale','Tresses'],hairColor:['Noir','Brun','Châtain','Cuivré','Gris','Blond'],
 beard:['Rasé','Courte / moustache','Fournie'],headband:['Sans','Ivoire','Équipe','Cuivre'],sleeve:['Sans','Ivoire','Équipe'],shoes:['Ivoire','Noires','Cuivrées','Équipe'],
};
const TITLES:Record<keyof typeof APPEARANCE_OPTIONS,string>={skin:'Peau',face:'Visage',hair:'Coiffure',hairColor:'Couleur des cheveux',beard:'Barbe',headband:'Bandeau',sleeve:'Manchon',shoes:'Chaussures'};
let images:Promise<HTMLImageElement[]>|undefined;
const sources=()=>images??=Promise.all([referenceSpriteUrl,referencePortraitUrl,bodyUrl,headUrl].map(url=>new Promise<HTMLImageElement>((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=url;})));
function SpritePreview({player,appearance}:{player:Player;appearance:PlayerAppearance}){
 const ref=useRef<HTMLCanvasElement>(null),[motion,setMotion]=useState<MotionId>('idle'),[back,setBack]=useState(false),[left,setLeft]=useState(false),[playing,setPlaying]=useState(true),[error,setError]=useState('');
 useEffect(()=>{let stopped=false,raf=0;const started=performance.now();sources().then(src=>{
  if(stopped)return;const look={...appearanceFor(player),cosmetics:appearance};const definition=MOTIONS.find(m=>m.id===motion)!;const anchors=Array.from({length:8},(_,i)=>clubhouseContact('dribbleIdle',i,back?'up':'down',player.heightCm,look.heavy,left));const frames=Array.from({length:definition.count},(_,i)=>paintClubhouse(src,look,0,motion,i,back?'up':'down',left?'left':'right'));
  const draw=(now:number)=>{if(stopped || !ref.current)return;const ctx=ref.current.getContext('2d')!;ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,192,116);ctx.fillStyle='#dfb879';ctx.fillRect(0,0,192,116);ctx.fillStyle='#d3a867';for(let y=0;y<116;y+=12)ctx.fillRect(0,y,192,1);ctx.fillStyle='#fff3d4';ctx.fillRect(0,90,192,1);
   const phase=playing?Math.max(0,now-started)%definition.ms/definition.ms:0,frame=frames[Math.floor(phase*frames.length)];ctx.drawImage(frame.canvas,48,6,96,96);if(frame.arm)ctx.drawImage(frame.arm.canvas,48+frame.arm.shoulder.x-32,6+frame.arm.shoulder.y-32,64,64);
   if(motion==='dribbleIdle' && frame.pose.ball){const p=dribbleBallAt(phase,anchors,FRAME.groundY-CLUBHOUSE_BALL_RADIUS)!;ctx.fillStyle='#d87720';ctx.beginPath();ctx.arc(48+p.x,6+p.y,3.5,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#402b20';ctx.stroke();ctx.drawImage(frame.hand,48,6,96,96);}
   raf=requestAnimationFrame(draw);
  };raf=requestAnimationFrame(draw);
 }).catch(()=>setError('Aperçu indisponible. Rechargez pour réessayer.'));return()=>{stopped=true;cancelAnimationFrame(raf);};},[player,appearance,motion,back,left,playing]);
 return <div className="workshop-sprite"><canvas ref={ref} width={192} height={116} aria-label="Sprite à la taille de match" role="img"/><p className="small">Taille logique à la caméra de match · gabarit {player.heightCm} cm</p><div className="row"><label>Geste <select value={motion} onChange={e=>setMotion(e.target.value as MotionId)}><option value="idle">Debout</option><option value="run">Course</option><option value="dribbleIdle">Dribble sur place</option><option value="jumpShot">Tir</option><option value="block">Contre</option></select></label><button className="btn btn-sm" onClick={()=>setBack(!back)}>{back?'Voir de face':'Voir de dos'}</button><button className="btn btn-sm" onClick={()=>setLeft(!left)}>{left?'Vers la droite':'Vers la gauche'}</button><button className="btn btn-sm" onClick={()=>setPlaying(!playing)}>{playing?'Figer':'Animer'}</button></div>{error && <p role="alert">{error}</p>}</div>;
}

function EquipmentThumbnail({player,appearance}:{player:Player;appearance:PlayerAppearance}){
 const ref=useRef<HTMLCanvasElement>(null);useEffect(()=>{let cancelled=false;sources().then(src=>{if(cancelled||!ref.current)return;const ctx=ref.current.getContext('2d')!;ctx.imageSmoothingEnabled=false;ctx.fillStyle='#dfb879';ctx.fillRect(0,0,48,48);const art=paintClubhouse(src,{...appearanceFor(player),cosmetics:appearance},0,'idle',0,'down','right');ctx.drawImage(art.canvas,60,105,75,65,0,0,48,48);});return()=>{cancelled=true;};},[player,appearance]);
 return <canvas ref={ref} width={48} height={48} aria-hidden="true" style={{width:44,height:44,imageRendering:'pixelated'}}/>;
}

export function AppearanceWorkshop({player,onClose}:{player:Player;onClose:()=>void}){
 const original=appearanceIdentity(player),[draft,setDraft]=useState(()=>original),[error,setError]=useState(''),ui=useUi(),dirty=appearanceKey(draft)!==appearanceKey(original);
 useDraftGuard(dirty);
 const cancel=()=>{setDraft(original);onClose();};
 return <section className="appearance-workshop" aria-label="Atelier d’apparence"><h2>Atelier d’apparence</h2><p>#{player.number} {player.firstName} {player.lastName} · Les changements restent en brouillon jusqu’à l’enregistrement.</p><div className="workshop-preview"><PlayerPortrait player={player} appearance={draft} size={144}/><SpritePreview player={player} appearance={draft}/></div>
 <div className="appearance-options">{(Object.keys(APPEARANCE_OPTIONS) as (keyof typeof APPEARANCE_OPTIONS)[]).map(key=><fieldset key={key}><legend>{TITLES[key]}</legend><div className="appearance-row">{LABELS[key].map((label,value)=>{
 const option=normalizeAppearance({...draft,[key]:value},draft),incompatible=key==='headband' && value===3 && draft.hair===4;
 return <button type="button" className="appearance-choice" key={value} aria-label={`${TITLES[key]} : ${label}`} aria-pressed={draft[key]===value} disabled={incompatible} title={incompatible?'Le bandeau cuivre est remplacé par l’ivoire avec les tresses attachées.':undefined} onClick={()=>{setDraft(option);setError('');}}>{key==='shoes'||key==='sleeve'?<EquipmentThumbnail player={player} appearance={option}/>:<PlayerPortrait player={player} appearance={option} size={44}/>}<span>{label}</span>{incompatible && <small>Avec tresses : ivoire</small>}</button>;
 })}</div></fieldset>)}</div>
 <div className="workshop-actions"><ActionFeedback state={dirty?'draft':'saved'} savedLabel="Apparence enregistrée">{dirty?'Apparence en brouillon.':'Apparence enregistrée.'}</ActionFeedback><button className="btn" onClick={cancel}>Annuler</button><button className="btn btn-primary" disabled={!dirty} onClick={()=>{const errors=store.setAppearance(player.id,draft);if(errors.length){setError(errors.join(' '));return;}ui.reportDecision('Apparence enregistrée. Elle sera utilisée au prochain match.');onClose();}}>Enregistrer l’apparence</button></div>{error && <p role="alert">{error}</p>}
 </section>;
}
