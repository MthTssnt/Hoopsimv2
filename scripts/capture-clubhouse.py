"""Normal-speed canvas captures, entered through the actual GM flow (no montage poses)."""
from playwright.sync_api import sync_playwright
from pathlib import Path
import argparse,json,subprocess
parser=argparse.ArgumentParser();parser.add_argument('--out',default='/tmp/hoopsim-clubhouse');parser.add_argument('--mode',choices=['all','play','block'],default='all');parser.add_argument('--block-step',type=int,default=0);args=parser.parse_args();out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader']);page=b.new_page(viewport={'width':1280,'height':720});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def start(mode):
  page.goto('http://127.0.0.1:5173/?atelier');page.evaluate('localStorage.clear()');page.reload();page.get_by_role('button',name='Découvrir Clubhouse • le #45 à Boston',exact=True).click();page.get_by_role('button',name='Préparer le match',exact=True).click();page.get_by_role('button',name=mode,exact=True).click();page.wait_for_function('window.__hoopsim!==undefined',timeout=180000);page.evaluate('window.__hoopsim.options(0,false)');page.add_style_tag(content='[aria-label="Inspecteur de match"]{display:none!important}')
 def begin():
  page.evaluate("""()=>{window.chunks=[];window.rec=new MediaRecorder(document.querySelector('canvas').captureStream(30),{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:7000000});window.rec.ondataavailable=e=>window.chunks.push(e.data);window.rec.start(1000);window.__hoopsim.play(true)}""")
 def end(label):
  page.evaluate('window.__hoopsim.play(false)');page.wait_for_timeout(100)
  with page.expect_download() as d:
   page.evaluate("""async()=>{await new Promise(r=>{window.rec.onstop=r;window.rec.stop()});const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(window.chunks,{type:'video/webm'}));a.download='capture.webm';a.click()}""")
  d.value.save_as(out/(label+'.webm'));page.screenshot(path=str(out/(label+'.png')));(out/(label+'.json')).write_text(json.dumps(page.evaluate('window.__hoopsim.snapshot()'),indent=2));(out/(label+'-inputs.json')).write_text(json.dumps(page.evaluate('window.__hoopsim.recording()')));print('Captured',label,flush=True)
  subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(out/(label+'.webm')),'-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-r','30',str(out/(label+'.mp4'))],check=True)
 if args.mode!='block':
  start('Jouer')
  # Find a genuine #45 possession, using the normal AI/physics from tip-off.
  for k in range(1500):
   s=page.evaluate('window.__hoopsim.snapshot()')
   if s['holder']==0 and s['players'][0]['id']=='pj' and not s['players'][0]['position']['z'] and s['phase']=='jeu':break
   page.evaluate('window.__hoopsim.advance(12)')
  else:raise Exception('No #45 possession')
  page.evaluate("window.__hoopsim.inputs(window.__hoopsim.snapshot().players.map(()=>({x:0,y:0,jump:false})))")
  begin();page.wait_for_timeout(1800)
  page.screenshot(path=str(out/'dribble-sur-place.png'))
  page.evaluate("()=>{const a=window.__hoopsim.snapshot().players.map(()=>({x:0,y:0,jump:false}));a[0].x=1;window.__hoopsim.inputs(a)}")
  page.wait_for_timeout(2400);page.screenshot(path=str(out/'dribble-en-course.png'))
  page.evaluate("()=>{const a=window.__hoopsim.snapshot().players.map(()=>({x:0,y:0,jump:false}));a[0].x=.85;a[0].y=-.3;window.__hoopsim.inputs(a)}");page.wait_for_timeout(800)
  page.evaluate("window.__hoopsim.inputs(window.__hoopsim.snapshot().players.map(()=>({x:0,y:0,jump:false})))")
  page.wait_for_timeout(500)
  page.evaluate("()=>{const a=window.__hoopsim.snapshot().players.map(()=>({x:0,y:0,jump:false}));a[0].jump=true;window.__hoopsim.inputs(a)}")
  page.wait_for_timeout(60)
  page.evaluate("window.__hoopsim.inputs(window.__hoopsim.snapshot().players.map(()=>({x:0,y:0,jump:false})))")
  page.wait_for_timeout(340)
  page.evaluate("()=>{const a=window.__hoopsim.snapshot().players.map(()=>({x:0,y:0,jump:false}));a[0].release=true;window.__hoopsim.inputs(a)}")
  page.wait_for_timeout(50)
  page.evaluate("window.__hoopsim.inputs(null)")
  page.wait_for_timeout(2200);end('45-dribble-tir')
 # Find a naturally resolved block in the SAME career's spectator game. Replay from tip-off
 # with the same AI seed, then record at normal speed immediately before the contact.
 if args.mode!='play':
  start('Regarder');found=None
  for k in range(0 if args.block_step else 10000):
   page.evaluate('window.__hoopsim.advance(60)');s=page.evaluate('window.__hoopsim.snapshot()');shot=s['lastShot']
   if shot and shot.get('block',{} ) and shot['block'].get('success'):
    found=s;break
   if s['matchOver']:break
  if args.block_step:found={'step':args.block_step,'players':[]};shot=None
  if not found:raise Exception('No natural block in this match')
  step=found['step'];
  if not args.block_step:(out/'block-discovery.json').write_text(json.dumps(found,indent=2))
  print('Natural block witness at step',step,flush=True)
  if not args.block_step:start('Regarder')
  remaining=max(0,step-240)
  while remaining:
   count=min(remaining,3600);page.evaluate('(n)=>window.__hoopsim.advance(n)',count);remaining-=count
  begin();page.wait_for_timeout(2100);contact=page.evaluate('window.__hoopsim.snapshot()');assert contact['lastShot']['block']['success'];(out/'block-in-playback.json').write_text(json.dumps(contact,indent=2));page.wait_for_timeout(2200);end('contre-match-reel')
 assert not errors,errors;b.close()
 print('All captures from real GM matches, normal-speed captureStream(30), no page errors.',flush=True)
