import {artCanvas,type ArtCanvas,type ArtSource} from './artCanvas';
import {HAIR_COLORS,SKIN_COLORS,type PlayerAppearance} from '../../../engine/appearance';
const originals=new WeakMap<ArtSource,Map<string,ArtCanvas>>();
/** Preserve the supplied pixels. Only the connected green presentation backdrop is keyed out. */
export function referenceCutout(source:ArtSource,kind:'sprite'|'portrait'):ArtCanvas {
 let cache=originals.get(source);if(!cache){cache=new Map();originals.set(source,cache);}const existing=cache.get(kind);if(existing)return existing;
 const rect=kind==='sprite'?{x:25,y:51,w:79,h:135}:{x:7,y:12,w:143,h:127};
 const c=artCanvas(rect.w,rect.h),ctx=c.getContext('2d')!;ctx.drawImage(source,rect.x,rect.y,rect.w,rect.h,0,0,rect.w,rect.h);
 const image=ctx.getImageData(0,0,c.width,c.height),p=image.data,seen=new Uint8Array(c.width*c.height),queue:number[]=[];
 const background=(i:number)=>{const r=p[i*4],g=p[i*4+1],b=p[i*4+2];return g-r>=10&&g-b>=5&&r<80;};
 const add=(i:number)=>{if(!seen[i]&&background(i)){seen[i]=1;queue.push(i);}};
 for(let x=0;x<c.width;x++){add(x);add((c.height-1)*c.width+x);}for(let y=0;y<c.height;y++){add(y*c.width);add(y*c.width+c.width-1);}
 for(let q=0;q<queue.length;q++){const i=queue[q],x=i%c.width,y=Math.floor(i/c.width);p[i*4+3]=0;if(x)add(i-1);if(x<c.width-1)add(i+1);if(y)add(i-c.width);if(y<c.height-1)add(i+c.width);}
 // Remove frame fragments and detached backing pixels, retaining the complete drawn figure.
 const components:number[][]=[],visited=new Uint8Array(c.width*c.height);
 for(let start=0;start<visited.length;start++){if(visited[start]||!p[start*4+3])continue;const group=[start];visited[start]=1;
  for(let q=0;q<group.length;q++){const i=group[q],x=i%c.width,y=Math.floor(i/c.width);for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,1],[-1,1],[1,-1]]){const nx=x+dx,ny=y+dy,j=ny*c.width+nx;if(nx>=0&&nx<c.width&&ny>=0&&ny<c.height&&!visited[j]&&p[j*4+3]){visited[j]=1;group.push(j);}}}components.push(group);}
 const largest=components.sort((a,b)=>b.length-a.length)[0],keep=new Set(largest);for(let i=0;i<visited.length;i++)if(!keep.has(i))p[i*4+3]=0;
 ctx.putImageData(image,0,0);cache.set(kind,c);return c;
}
const rgb=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
export const clubhouseJersey=(primary:string)=>['#008348','#047857'].includes(primary.toLowerCase())?'#173f2b':primary;
/** Default #45 retains the reference palette; cosmetic edits remain shared by portrait and match. */
export function referencePortrait(source:ArtSource,look:PlayerAppearance,primary:string):ArtCanvas {
 const original=referenceCutout(source,'portrait'),c=artCanvas(original.width,original.height),ctx=c.getContext('2d')!;ctx.drawImage(original,0,0);
 const image=ctx.getImageData(0,0,c.width,c.height),p=image.data,skin=rgb(SKIN_COLORS[look.skin]),hair=rgb(HAIR_COLORS[look.hairColor]),kit=rgb(clubhouseJersey(primary));
 for(let i=0;i<p.length;i+=4){if(!p[i+3])continue;const r=p[i],g=p[i+1],b=p[i+2],y=Math.floor(i/4/c.width),x=i/4%c.width;let color:number[]|undefined;
  if(look.skin!==2 && r>70&&r>g*1.2&&g>b*1.2)color=skin.map(v=>Math.min(255,Math.round(v*Math.max(.55,Math.min(1.15,(r+g+b)/290)))));
  else if(!['#008348','#047857'].includes(primary.toLowerCase()) && y>90 && g>r*1.3&&g>b*1.1)color=kit.map(v=>Math.min(255,Math.round(v*Math.min(1.2,(r+g+b)/95))));
  else if(look.hairColor!==0 && y<107 && r<85&&g<75&&b<65 && r>g)color=hair.map(v=>Math.min(255,Math.round(v*(.6+(r+g+b)/260))));
  if(look.headband!==1 && y>25&&y<48 && r>180&&g>160&&b>105)color=rgb([HAIR_COLORS[look.hairColor],'#f5e5bd',primary,'#bc6c34'][look.headband]);
  if(look.beard!==1 && x>52&&x<112&&y>91&&y<113&&r<70&&g<55&&b<45)color=look.beard===0?(look.skin===2?[147,83,42]:skin):hair;
  if(color)p.set(color,i);
 }
 ctx.putImageData(image,0,0);return c;
}
export function referenceHead(source:ArtSource,look:PlayerAppearance,primary:string):ArtCanvas {
 const portrait=referencePortrait(source,look,primary),head=artCanvas(96,96),ctx=head.getContext('2d')!;ctx.imageSmoothingEnabled=false;
 // Original 03: head only, including twists, ivory band, eyes and beard; collar stays in the body layer.
 const crop=artCanvas(108,116),cc=crop.getContext('2d')!;cc.drawImage(portrait,24,0,108,116,0,0,108,116);
 const pixels=cc.getImageData(0,0,108,116);for(let y=75;y<116;y++)for(let x=0;x<108;x++){const i=(y*108+x)*4,r=pixels.data[i],g=pixels.data[i+1],b=pixels.data[i+2];if((y>=90&&(x<24||x>82))||(r>90&&g>r*.75&&b>g*.6)||(g>r*1.05&&g>b*1.1))pixels.data[i+3]=0;}cc.putImageData(pixels,0,0);
 ctx.drawImage(crop,0,0,108,116,11,14,74,80);return head;
}
