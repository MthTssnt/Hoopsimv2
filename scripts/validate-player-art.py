"""Browser regression checks; run against npm run dev with Playwright Python and Chromium installed."""
import os
import json
from pathlib import Path
Path(os.environ.get('HOOPSIM_EVIDENCE_DIR', '/tmp/hoopsim-reconstruction')).mkdir(parents=True, exist_ok=True)
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=b.new_page();page.goto('http://127.0.0.1:5173/?anims',wait_until='networkidle')
 report=page.evaluate('''async()=>{
 const {PLAYER_SOURCES}=await import('/src/assets/players/sources.ts');
 const {paintMotion}=await import('/src/match/render/sprites/motionArt.ts');
 const {MOTION_FRAMES}=await import('/src/match/render/sprites/layout.ts');
 const {composePlayer}=await import('/src/match/render/sprites/composePlayer.ts');
 const {PlayerComposer}=await import('/src/match/render/sprites/composer.ts');
 const images=await Promise.all(PLAYER_SOURCES.map(async url=>{const i=new Image();i.src=url;await i.decode();return i}));
 let count=0, contacts=0, maskPairs=0;
 for(let team=0;team<2;team++)for(let variant=0;variant<5;variant++)for(const heightCm of [180,220])for(const heavy of [false,true])for(const heading of ['down','up'])for(const m of MOTION_FRAMES){
  const look={heightCm,heavy,variant,number:23,dominantHand:'droite'};
  const r=paintMotion(images,look,team,m.motion,m.frame,heading,'right');
  const l=paintMotion(images,look,team,m.motion,m.frame,heading,'left');
  for(const art of [r,l]) { const b=art.bounds; if(b.left<=0||b.right>=191||b.top<=0||b.bottom>=191)throw Error('Out of frame '+JSON.stringify({team,variant,heightCm,heavy,heading,m})); count++; }
  if(r.pose.ball){ if(Math.abs(r.pose.ball.x+l.pose.ball.x-96)>1e-7||Math.abs(r.pose.ball.y-l.pose.ball.y)>1e-7)throw Error('Anchor mirror mismatch');contacts++; }
  const a=r.hand.getContext('2d').getImageData(0,0,192,192).data,c=l.hand.getContext('2d').getImageData(0,0,192,192).data;
  for(let y=0;y<192;y++)for(let x=0;x<192;x++)if(a[(y*192+x)*4+3]!==c[(y*192+191-x)*4+3])throw Error('Finger mask mirror mismatch');maskPairs++;
 }
 const look={heightCm:220,heavy:true,variant:0,number:23,dominantHand:'droite'};
 const main=composePlayer(images,look,0), composer=new PlayerComposer(images);await composer.init();const worker=await composer.compose(look,0);composer.close();
 const raster=image=>{const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);return ctx.getImageData(0,0,c.width,c.height).data};
 const diff=(a,b)=>{if(a.length!==b.length)throw Error('Dimensions differ');let n=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])n++;return n};
 const atlasDiff=diff(raster(main.atlas),raster(worker.atlas)),handDiff=diff(raster(main.hands),raster(worker.hands));worker.atlas.close();worker.hands.close();
 if(atlasDiff||handDiff)throw Error('Worker raster mismatch '+atlasDiff+'/'+handDiff);
 return {renderedPoses:count,anchorPairs:contacts,maskPairs,workerAtlasByteDifferences:atlasDiff,workerHandsByteDifferences:handDiff};
 }''')
 b.close()
(Path(os.environ.get('HOOPSIM_EVIDENCE_DIR', '/tmp/hoopsim-reconstruction')) / 'art-validation.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
