import {referencePortrait} from '../../match/render/sprites/reference45';
import referenceUrl from '../../assets/players/clubhouse/reference/portrait-45.png';
import {clubhouseHead} from '../../match/render/sprites/clubhouseHead';
import {useEffect,useRef} from 'react';
import {appearanceIdentity,type PlayerAppearance} from '../../engine/appearance';
import {TEAM_SEEDS} from '../../engine/teamsData';
import type {Player} from '../../engine/types';
import headUrl from '../../assets/players/clubhouse/heads.png';
let source:Promise<HTMLImageElement>|undefined;let referenceSource:Promise<HTMLImageElement>|undefined;
const reference=()=>referenceSource??=new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=referenceUrl;});
const heads=()=>source ??= new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=headUrl;});
export function PlayerPortrait({player,size=96,appearance}:{player:Player;size?:number;appearance?:PlayerAppearance}){
 const ref=useRef<HTMLCanvasElement>(null),look=appearance ?? appearanceIdentity(player);
 const colors=TEAM_SEEDS.find(t=>t.id===player.teamId)?.colors ?? {primary:'#174630',secondary:'#fff2d3'};
 useEffect(()=>{let cancelled=false;Promise.all([heads(),reference()]).then(([image,original])=>{if(cancelled || !ref.current)return;const ctx=ref.current.getContext('2d')!;ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,96,96);ctx.fillStyle='#f1e2c4';ctx.fillRect(0,0,96,96);
 const bust=referencePortrait(original,look,colors.primary);const ratio=96/bust.width,height=bust.height*ratio;const bustWidth=look.hair===0?96*[1,.94,1.05][look.face]:96;ctx.drawImage(bust,(96-bustWidth)/2,96-height,bustWidth,height);
 if(look.hair!==0){ctx.fillStyle='#f1e2c4';ctx.fillRect(0,0,96,74);const head=clubhouseHead(image,look,colors.primary),width=80*[1,.94,1.05][look.face];ctx.drawImage(head,8+(80-width)/2,0,width,80);}
 }).catch(()=>{});return()=>{cancelled=true;};},[look.skin,look.hair,look.hairColor,look.headband,look.beard,look.face,colors.primary,colors.secondary]);
 return <canvas ref={ref} width={96} height={96} className="player-portrait" role="img" aria-label={`Portrait de ${player.firstName} ${player.lastName}`} style={{width:size,height:size,imageRendering:'pixelated'}}/>;
}
