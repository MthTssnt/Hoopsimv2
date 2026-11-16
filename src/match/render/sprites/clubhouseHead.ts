import {HAIR_COLORS,SKIN_COLORS,type PlayerAppearance} from '../../../engine/appearance';
import {artCanvas,type ArtSource} from './artCanvas';
const rgb=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const tint=(color:number[],k:number)=>color.map(v=>Math.max(0,Math.min(255,Math.round(v*k))));
/** One palette/mask definition for portraits, workshop and the match worker. */
export function clubhouseHead(source:ArtSource,identity:PlayerAppearance,primary:string,back=false){
 const head=artCanvas(96,96),ctx=head.getContext('2d')!;ctx.imageSmoothingEnabled=false;
 ctx.drawImage(source,identity.hair*96,back?96:0,96,96,0,0,96,96);
 const image=ctx.getImageData(0,0,96,96),p=image.data,skin=rgb(SKIN_COLORS[identity.skin]),hair=rgb(HAIR_COLORS[identity.hairColor]);
 for(let i=0;i<p.length;i+=4){if(p[i+3]<128)continue;const r=p[i],g=p[i+1],b=p[i+2],x=i/4%96,y=Math.floor(i/4/96);let color:number[]|null=null;
  const isSkin=identity.hair===2?r>195 && r>g*1.08:r>75 && r>g*1.15 && g>b*1.1;
  const chin=!back && x>33 && x<77 && y>69 && y<85;
  if(chin && identity.beard===0 && r<110 && g<90 && b<75)color=tint(skin,.72);
  else if(isSkin)color=tint(skin,Math.max(.6,Math.min(1.15,(r+g+b)/(identity.hair===2?560:320))));
  else if(r>35 && r<155 && g<125 && b<105)color=tint(hair,.7+(r+g+b)/350);
  else if(identity.hair===0 && y<58 && r>170 && g>160 && b>120)color=identity.headband===0?hair:rgb(['#251e1a','#fff2d3',primary,'#bc6c34'][identity.headband]);
  if(!back && chin && identity.beard>0 && isSkin && (identity.beard===2?y>74:y>79 && x<65))color=tint(hair,.85);
  if(identity.headband && identity.hair!==0 && y>=37 && y<42 && x>20 && x<77)color=rgb(['','#fff2d3',primary,'#bc6c34'][identity.headband]);
  if(color)p.set(color,i);
 }
 ctx.putImageData(image,0,0);return head;
}
