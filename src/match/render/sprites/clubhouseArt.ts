import {referenceCutout,referenceHead,clubhouseJersey} from './reference45';
import {cleanPose} from './contactPixels';
import {clubhouseHead} from './clubhouseHead';
import {APPEARANCE_PRESETS,SKIN_COLORS,appearanceKey} from '../../../engine/appearance';
import {drawJerseyNumber,jerseyNumberWidth} from '../../../assets/sprites/jerseyDigits';
import {artCanvas,type ArtSource,type ArtCanvas} from './artCanvas';
import type {Appearance} from './appearance';
import {FRAME,SPRITE_DETAIL as D,type Heading,type Facing} from './views';
import {clubhouseCell,clubhouseContact,clubhouseScale,CLUBHOUSE_MANIFEST,CLUBHOUSE_BALL_RADIUS} from './clubhouseGeometry';
import {dribbleFlightY,type MotionId} from './motion';
import type {MotionArtFrame} from './motionArt';
const rgb=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const tint=(color:number[],k:number)=>color.map(v=>Math.max(0,Math.min(255,Math.round(v*k))));
const jerseyMasks=new WeakMap<ArtCanvas,Uint8Array>();
const sourceCache=new WeakMap<ArtSource,Map<string,ArtCanvas>>();
export function paintClubhouse(sources:readonly ArtSource[],look:Appearance,team:number,id:MotionId,frame:number,heading:Heading,facing:Facing):MotionArtFrame {
 const identity=look.cosmetics ?? APPEARANCE_PRESETS[look.variant%5],cell=clubhouseCell(id,frame,heading),meta=CLUBHOUSE_MANIFEST.frames[cell];
 const body=sources[sources.length-2],heads=sources[sources.length-1],referenceSprite=sources.length>=4?sources[sources.length-4]:undefined,referenceFace=sources.length>=4?sources[sources.length-3]:undefined;
 const referenceIdle=!!referenceSprite && team===0&&['#008348','#047857'].includes(look.colors?.primary?.toLowerCase()??'')&&id==='idle'&&heading==='down'&&look.number===45&&identity.hair===0&&identity.skin===2&&identity.face===0&&identity.hairColor===0&&identity.beard===1&&identity.headband===1&&identity.shoes===0&&identity.sleeve===0;
 let cache=sourceCache.get(body);if(!cache){cache=new Map();sourceCache.set(body,cache);}
 const color=look.colors ?? {primary:'#174630',secondary:'#fff2d3'},primary=rgb(team===0?clubhouseJersey(color.primary):'#f2e2bf'),trim=rgb(team===0?'#f2e2bf':clubhouseJersey(color.primary)),skin=rgb(SKIN_COLORS[identity.skin]);
 const key=[cell,id==='dribbleIdle'?'fixed':id==='dribble'?'gait':'pose',appearanceKey(identity),team,color.primary,referenceIdle?'reference':'module'].join(':');
 let base=cache.get(key);
 if(!base){
  base=artCanvas(192,192);const ctx=base.getContext('2d')!;ctx.imageSmoothingEnabled=false;
  if(referenceIdle){const sprite=referenceCutout(referenceSprite!,'sprite'),ratio=70/sprite.height;ctx.drawImage(sprite,96-sprite.width*ratio/2,98,sprite.width*ratio,70);}else ctx.drawImage(body,cell%8*192,Math.floor(cell/8)*192,192,192,0,0,192,192);
  let dribbleArm:ArtCanvas|undefined;
  if((id==='dribble'||id==='dribbleIdle') && 'hand' in meta && meta.hand){
   // Keep the established physical ball path. Retarget only this painted forearm to it.
   const root={x:(meta.head.x+meta.head.w/2+2)/2,y:(meta.neck+4)/2},from=meta.hand,target={x:meta.palm.x-.5,y:meta.palm.y-meta.contactOffset};
   const dx=from.x-root.x,dy=from.y-root.y,length=Math.hypot(dx,dy),tx=target.x-root.x,ty=target.y-root.y;
   const layer=artCanvas(192,192),lc=layer.getContext('2d')!,source=ctx.getImageData(0,0,192,192),mask=lc.createImageData(192,192);
   // Select the original skin islands at shoulder and hand, then include their inked edges.
   // A fixed narrow capsule left fingertip fragments behind when the painted arm was bent.
   const skinAt=(x:number,y:number)=>{const i=(y*192+x)*4,r=source.data[i],g=source.data[i+1],b=source.data[i+2];return source.data[i+3]>128&&r>75&&r>g*1.15&&g>b*1.12;};
   const seen=new Set<number>(),groups:number[][]=[];
   const minX=Math.max(0,Math.floor(root.x*2)-6),minY=Math.max(0,Math.floor(root.y*2)-3);
   for(let y=minY;y<164;y++)for(let x=minX;x<150;x++){const index=y*192+x;if(seen.has(index)||!skinAt(x,y))continue;const group=[index];seen.add(index);for(let q=0;q<group.length;q++){const a=group[q]%192,b=Math.floor(group[q]/192);for(const [ox,oy] of [[-1,0],[1,0],[0,-1],[0,1]]){const xx=a+ox,yy=b+oy,j=yy*192+xx;if(xx>=minX&&xx<150&&yy>=minY&&yy<164&&!seen.has(j)&&skinAt(xx,yy)){seen.add(j);group.push(j);}}}groups.push(group);}
   const closest=(point:{x:number;y:number},candidates=groups)=>candidates.reduce<number[]>((best,group)=>{const distance=(g:number[])=>Math.min(...g.map(i=>(i%192-point.x*2)**2+(Math.floor(i/192)-point.y*2)**2));return !best.length||distance(group)<distance(best)?group:best;},[]);
   const shoulderGroups=groups.filter(group=>group.every(i=>Math.floor(i/192)>=root.y*2-1));
   const selected=new Set([...closest(root,shoulderGroups),...closest(from)]),ink=new Set<number>();
   for(const i of selected)for(let oy=-4;oy<=4;oy++)for(let ox=-4;ox<=4;ox++){const x=i%192+ox,y=Math.floor(i/192)+oy;if(x>=minX&&x<192&&y>=minY&&y<192&&Math.hypot(ox,oy)<=4.1)ink.add(y*192+x);}
   for(const index of ink){const i=index*4,x=index%192,y=Math.floor(index/192),r=source.data[i],g=source.data[i+1],b=source.data[i+2];
    const jersey=g>r*1.05&&g>b*1.05&&g>35,collar=r>100&&g>r*.8&&b>g*.6&&x<root.x*2+3&&y<meta.neck+17;
    if(!source.data[i+3]||(heading==='down'&&(jersey||collar||x<root.x*2)))continue;mask.data.set(source.data.subarray(i,i+4),i);source.data[i+3]=0;}
   lc.putImageData(mask,0,0);ctx.putImageData(source,0,0);dribbleArm=artCanvas(192,192);const dc=dribbleArm.getContext('2d')!;dc.imageSmoothingEnabled=false;dc.translate(root.x*2,root.y*2);dc.rotate(Math.atan2(ty,tx));dc.scale(Math.hypot(tx,ty)/(length||1),1);dc.rotate(-Math.atan2(dy,dx));dc.drawImage(layer,-root.x*2,-root.y*2);ctx.drawImage(dribbleArm,0,0);
  }
  // Plant both feet after retargeting the arm, so this lower-body crop cannot erase the hand.
  if(id==='dribbleIdle'){
   const legs=clubhouseCell('dribbleIdle',0,heading);
   ctx.clearRect(72,145,43,47);ctx.drawImage(body,legs%8*192+72,Math.floor(legs/8)*192+145,43,47,72,145,43,47);
  }
  if(id==='dribbleIdle'&&dribbleArm)ctx.drawImage(dribbleArm,0,0);
  const image=ctx.getImageData(0,0,192,192),data=image.data,shirt=new Uint8Array(192*192);
  for(let i=0;i<data.length;i+=4){if(data[i+3]<128)continue;const r=data[i],g=data[i+1],b=data[i+2],y=Math.floor(i/4/192);let c:number[]|null=null;
   if(r>75 && r>g*1.15 && g>b*1.12){if(identity.skin!==2)c=tint(skin,Math.max(.58,Math.min(1.18,(r+g+b)/290)));}
   else if(g>r*1.05 && g>b*1.05 && g>35){if(!referenceIdle || team!==0 || !['#008348','#047857'].includes(color.primary.toLowerCase()))c=tint(primary,Math.max(.55,Math.min(1.2,(r+g+b)/140)));shirt[i/4]=1;}
   else if(r>175 && g>165 && b>125 && !referenceIdle)c=tint(y>157 && identity.shoes>0?rgb(['#fff2d3','#171e22','#c58a42',color.primary][identity.shoes]):trim,.95);
   if(c)data.set(c,i);
  }
  ctx.putImageData(image,0,0);jerseyMasks.set(base,shirt);
  // Interchangeable artist-drawn head, with palette masks and per-pose neck anchor.
  const inFront=artCanvas(192,192);inFront.getContext('2d')!.drawImage(base,0,0);
  if(!referenceIdle){
   ctx.clearRect(meta.erase.x,meta.erase.y,meta.erase.w,meta.erase.h);
   const head=identity.hair===0&&heading==='down'&&referenceFace?referenceHead(referenceFace,identity,color.primary):clubhouseHead(heads,identity,color.primary,heading==='up');
   const width=meta.head.w*[1,.94,1.05][identity.face];ctx.drawImage(head,0,0,96,96,meta.head.x+(meta.head.w-width)/2,meta.head.y+(cell>=128?5:0),width,meta.head.h);
  }
  if((frame%4===1 || frame%4===2) && !['idle','run','dribble','dribbleIdle'].includes(id)){
   // Restore the artist's foreground wrist/arm after replacing the head behind it.
   const previous=inFront.getContext('2d')!.getImageData(0,0,192,192),current=ctx.getImageData(0,0,192,192),root={x:meta.head.x+meta.head.w/2+10,y:meta.neck+5},tip={x:meta.palm.x*2,y:meta.palm.y*2};
   const vx=tip.x-root.x,vy=tip.y-root.y,len=vx*vx+vy*vy;
   for(let y=0;y<192;y++)for(let x=Math.ceil(meta.head.x+meta.head.w/2+6);x<192;x++){
    const t=Math.max(0,Math.min(1,((x-root.x)*vx+(y-root.y)*vy)/(len||1))),i=(y*192+x)*4;
    if(Math.hypot(x-root.x-vx*t,y-root.y-vy*t)<=5 && previous.data[i+3])current.data.set(previous.data.subarray(i,i+4),i);
   }ctx.putImageData(current,0,0);
  }
  if(identity.sleeve){const p=meta.palm;ctx.save();ctx.globalCompositeOperation='source-atop';ctx.fillStyle=identity.sleeve===1?'#fff2d3':color.primary;ctx.fillRect(p.x*2-8,p.y*2-13,9,8);ctx.restore();}
  const cleaned=ctx.getImageData(0,0,192,192);cleanPose(cleaned.data,192,192,false,12);ctx.putImageData(cleaned,0,0);
  if(cache.size>180)cache.clear();cache.set(key,base);
 }
 const c=artCanvas(FRAME.width*D,FRAME.height*D),ctx=c.getContext('2d')!;ctx.imageSmoothingEnabled=false;const scale=clubhouseScale(look.heightCm,look.heavy),sy=scale.height/35,sx=sy*scale.width;
 ctx.drawImage(base,0,0,192,192,Math.round(96-96*sx),Math.round(168-168*sy),Math.round(192*sx),Math.round(192*sy));
 let output=c;if(facing==='left'){output=artCanvas(192,192);const d=output.getContext('2d')!;d.translate(192,0);d.scale(-1,1);d.drawImage(c,0,0);}
 const oc=output.getContext('2d')!;oc.fillStyle=team===0?'#fff2d3':color.primary;
 let chestX=96;const chestY=meta.neck+(cell>=128?10:3);
 if(cell>=128){const mask=jerseyMasks.get(base!);let sum=0,count=0;for(let y=chestY;y<chestY+6;y++)for(let x=80;x<113;x++)if(mask?.[y*192+x]){sum+=x;count++;}if(count)chestX=sum/count;}
 const nx=Math.round(96+(chestX-96)*sx-jerseyNumberWidth(look.number)/2),ny=Math.round(168+(chestY-168)*sy);
 if(!referenceIdle){oc.save();oc.globalCompositeOperation='source-atop';drawJerseyNumber(look.number,0,0,(x,y)=>{const px=nx+x,py=ny+y,sourceX=Math.floor(96+((facing==='left'?192-px-.5:px+.5)-96)/sx),sourceY=Math.floor(168+(py+.5-168)/sy);if(sourceX>=0&&sourceX<192&&sourceY>=0&&sourceY<192&&jerseyMasks.get(base!)?.[sourceY*192+sourceX])oc.fillRect(px,py,1,1);});oc.restore();}else if(facing==='left'){const bx=Math.round(96+(86-96)*sx),by=Math.round(168+(128-168)*sy),bw=Math.round(19*sx),bh=Math.round(20*sy);oc.drawImage(c,bx,by,bw,bh,192-bx-bw,by,bw,bh);}
 const mirror=facing==='left';let ball=clubhouseContact(id,frame,heading,look.heightCm,look.heavy,mirror);const free=(id==='dribble'||id==='dribbleIdle') && frame>1 && frame<6;
 if(id==='dribble'||id==='dribbleIdle'){
  const a=clubhouseContact(id,1,heading,look.heightCm,look.heavy,mirror),b=clubhouseContact(id,6,heading,look.heightCm,look.heavy,mirror);
  const y=dribbleFlightY(frame,a.y,b.y,FRAME.groundY-CLUBHOUSE_BALL_RADIUS);if(y!==null)ball={x:a.x+(b.x-a.x)*(frame-1)/5,y};
 }
 const hand=artCanvas(192,192),h=hand.getContext('2d')!;const palm=free?null:ball;
 if(palm){
  // Only the 13-pixel contact disk can contain foreground fingers. Reading the entire
  // 192×192 pose here multiplied preparation work by the whole roster and all four views.
  const ax=Math.max(0,Math.floor(palm.x*2)-7),ay=Math.max(0,Math.floor(palm.y*2)-7),w=Math.min(14,192-ax),height=Math.min(14,192-ay);
  h.drawImage(output,ax,ay,w,height,ax,ay,w,height);const px=h.getImageData(ax,ay,w,height);
  for(let i=0;i<px.data.length;i+=4){const x=ax+i/4%w,y=ay+Math.floor(i/4/w),r=px.data[i],g=px.data[i+1],b=px.data[i+2];if(Math.hypot(x-palm.x*2,y-palm.y*2)>6 || !(r>g*1.12 && g>b*1.05))px.data[i+3]=0;}h.putImageData(px,ax,ay);
 }

 const pixels=oc.getImageData(0,0,192,192).data;let left=192,right=0,top=192,bottom=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>180){const x=i/4%192,y=Math.floor(i/4/192);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 let arm:MotionArtFrame['arm'];
 if((id==='block'||id==='blockOff') && (frame===1 || frame===2)){
  // A controlled per-pose mask keeps the artist-drawn arm, its outline and fingers.
  // The match can aim this one painted layer inside its existing contact cone.
  const shoulder={x:48+(mirror?-7:7)*sx,y:84+(meta.neck+6-168)/2*sy};
  const layer=artCanvas(128,128),lc=layer.getContext('2d')!;lc.imageSmoothingEnabled=false;
  const src=oc.getImageData(0,0,192,192),mask=lc.createImageData(128,128),vx=ball.x-shoulder.x,vy=ball.y-shoulder.y,len=vx*vx+vy*vy;
  const hx=48+(meta.head.x/2-48)*sx,hy=84+(meta.head.y/2-84)*sy,hw=meta.head.w/2*sx,hh=meta.head.h/2*sy;
  for(let y=0;y<192;y++)for(let x=0;x<192;x++){
   const px=x/2,py=y/2,t=Math.max(0,Math.min(1,((px-shoulder.x)*vx+(py-shoulder.y)*vy)/len));
   const headX=mirror?96-hx-hw:hx;
   if(px>headX && px<headX+hw-2 && py>hy && py<hy+hh-2)continue;
   const distance=Math.hypot(px-shoulder.x-vx*t,py-shoulder.y-vy*t),i=(y*192+x)*4;
   if(distance>2.8 || !src.data[i+3])continue;
   const tx=Math.round(x-shoulder.x*2+64),ty=Math.round(y-shoulder.y*2+64);
   if(tx<0||tx>=128||ty<0||ty>=128)continue;
   mask.data.set(src.data.subarray(i,i+4),(ty*128+tx)*4);src.data[i+3]=0;
  }
  lc.putImageData(mask,0,0);oc.putImageData(src,0,0);arm={canvas:layer,shoulder,tip:{x:vx,y:vy}};
 }
 return {arm,canvas:output,hand,handCenter:ball,pose:{height:scale.height,ball:{...ball,behind:heading==='up'},palm,contact:!free},bounds:{left,right,top,bottom}};
}
