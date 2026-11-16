"""Inspect composed pixels in Chromium, including the worker-compatible painted arm layer."""
from playwright.sync_api import sync_playwright
from pathlib import Path
import json
out=Path('/tmp/hoopsim-clubhouse');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':1536,'height':768});page.goto('http://127.0.0.1:5173/')
 result=page.evaluate('''async()=>{
 const [{paintClubhouse},{MOTIONS},{APPEARANCE_PRESETS},{default:body},{default:head},{default:refSprite},{default:refPortrait}]=await Promise.all([import('/src/match/render/sprites/clubhouseArt.ts'),import('/src/match/render/sprites/motion.ts'),import('/src/engine/appearance.ts'),import('/src/assets/players/clubhouse/body.png?url'),import('/src/assets/players/clubhouse/heads.png?url'),import('/src/assets/players/clubhouse/reference/sprite-45.png?url'),import('/src/assets/players/clubhouse/reference/portrait-45.png?url')]);
 const sources=await Promise.all([refSprite,refPortrait,body,head].map(url=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=url})));
 const base={heightCm:195,heavy:false,number:45,variant:0,dominantHand:'droite',cosmetics:APPEARANCE_PRESETS[0],colors:{primary:'#047857',secondary:'#f5f5f4'}};
 let checked=0,maxContactGap=0;const idleHeights=[],failures=[];
 const fullCanvas=(art)=>{const c=document.createElement('canvas');c.width=c.height=192;const x=c.getContext('2d');x.drawImage(art.canvas,0,0);if(art.arm)x.drawImage(art.arm.canvas,art.arm.shoulder.x*2-64,art.arm.shoulder.y*2-64);return c;};
 for(const heightCm of [175,195,222])for(const heavy of [false,true])for(const heading of ['up','down'])for(const facing of ['right','left'])for(const motion of MOTIONS)for(let frame=0;frame<motion.count;frame++){
  const a=paintClubhouse(sources,{...base,heightCm,heavy},0,motion.id,frame,heading,facing);checked++;
  if(a.bounds.left<1||a.bounds.top<1||a.bounds.right>190||a.bounds.bottom>190)failures.push(`clipped ${motion.id}/${frame}`);
  if(motion.id==='idle'&&frame===0&&!heavy&&heading==='down'&&facing==='right')idleHeights.push({heightCm,paintedHeight:(a.bounds.bottom-a.bounds.top+1)/2});
  if(a.pose.palm){const im=fullCanvas(a).getContext('2d').getImageData(0,0,192,192);let closest=100;
   for(let y=Math.max(0,Math.floor(a.pose.palm.y*2-12));y<Math.min(192,a.pose.palm.y*2+12);y++)for(let x=Math.max(0,Math.floor(a.pose.palm.x*2-12));x<Math.min(192,a.pose.palm.x*2+12);x++)if(im.data[(y*192+x)*4+3]>180)closest=Math.min(closest,Math.hypot(x/2-a.pose.palm.x,y/2-a.pose.palm.y));
   maxContactGap=Math.max(maxContactGap,closest);if(closest>5)failures.push(`hand gap ${motion.id}/${frame}/${heading}/${facing}: ${closest}`);
  }
 }
 const detached=[];
 for(const id of ['dribbleIdle','dribble'])for(const heading of ['down','up'])for(const facing of ['right','left'])for(let frame=0;frame<8;frame++){
  const a=paintClubhouse(sources,{...base,heightCm:185,heavy:true},0,id,frame,heading,facing),p=a.canvas.getContext('2d').getImageData(0,0,192,192).data,seen=new Uint8Array(192*192),sizes=[];
  for(let start=0;start<seen.length;start++){if(seen[start]||p[start*4+3]<128)continue;const q=[start];seen[start]=1;for(let k=0;k<q.length;k++){const x=q[k]%192,y=Math.floor(q[k]/192);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy,i=yy*192+xx;if(xx>=0&&xx<192&&yy>=0&&yy<192&&!seen[i]&&p[i*4+3]>=128){seen[i]=1;q.push(i);}}}sizes.push(q.length);}
  sizes.sort((a,b)=>b-a);if(sizes[1]>12)detached.push(`${id}/${frame}/${heading}/${facing}: ${sizes.slice(1)}`);
 }
 failures.push(...detached.map(p=>'detached body part '+p));
 const planted=[];for(let frame=0;frame<8;frame++){const a=paintClubhouse(sources,base,0,'dribbleIdle',frame,'down','right');planted.push(Array.from(a.canvas.getContext('2d').getImageData(72,158,43,16).data).join());}
 if(!planted.every(p=>p===planted[0]))failures.push('stationary feet changed');
 const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=768;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.fillStyle='#d8c69d';ctx.fillRect(0,0,1536,768);
 const cases=[['idle',0],...Array.from({length:8},(_,i)=>['dribbleIdle',i]),...Array.from({length:4},(_,i)=>['jumpShot',i]),...Array.from({length:4},(_,i)=>['block',i]),['layup',2],['dunk',2],['pass',2],['catch',0],['rebound',1],['tipoff',2],['landing',1]];
 cases.forEach(([id,frame],index)=>{const x=index%8*192,y=Math.floor(index/8)*192,a=paintClubhouse(sources,base,0,id,frame,'down','right');ctx.drawImage(fullCanvas(a),x,y);if(['dribbleIdle','jumpShot'].includes(id)&&a.pose.ball){ctx.fillStyle='#df7c1d';ctx.beginPath();ctx.arc(x+a.pose.ball.x*2,y+a.pose.ball.y*2,7,0,Math.PI*2);ctx.fill();ctx.drawImage(a.hand,x,y);}ctx.fillStyle='#173d2c';ctx.font='12px monospace';ctx.fillText(id+' '+frame,x+12,y+185);});document.body.replaceChildren(canvas);document.body.style.margin='0';
 return {checked,idleHeights,maxContactGap,coherentDribblePoses:64-detached.length,stationaryFeetIdentical:planted.every(p=>p===planted[0]),failures};
}''')
 page.screenshot(path=str(out/'composed-poses.png'));b.close();(out/'art-validation.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,ensure_ascii=False));assert not result['failures'],result['failures']
