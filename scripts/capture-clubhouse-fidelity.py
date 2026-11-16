"""Real GM match witness: source-aligned idle, then normal-speed dribble / run / stop."""
from playwright.sync_api import sync_playwright
from pathlib import Path
import json,subprocess,argparse,base64
parser=argparse.ArgumentParser();parser.add_argument('--canvas',action='store_true');parser.add_argument('--out',default='docs/validation/clubhouse-fidelity');args=parser.parse_args();out=Path(args.out).resolve();out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader']+(['--disable-webgl'] if args.canvas else []));page=b.new_page(viewport={'width':1672,'height':941});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:5173/?atelier');page.get_by_role('button',name='Découvrir Clubhouse • le #45 à Boston',exact=True).click();page.wait_for_timeout(400);page.screenshot(path=str(out/'franchise-jeu.png'))
 (out/'portrait-jeu.png').write_bytes(base64.b64decode(page.locator('.club-player').first.locator('canvas').evaluate('(c)=>c.toDataURL().split(",")[1]')))
 page.set_viewport_size({'width':1280,'height':720});page.get_by_role('button',name='Préparer le match',exact=True).click();page.get_by_role('button',name='Jouer',exact=True).click();page.wait_for_function('window.__hoopsim!==undefined',timeout=180000);page.evaluate('window.__hoopsim.options(0,false)');page.add_style_tag(content='[aria-label="Inspecteur de match"]{display:none!important}')
 def snap():return page.evaluate('window.__hoopsim.snapshot()')
 def inputs(x=0,y=0):page.evaluate('''([x,y])=>{const a=window.__hoopsim.snapshot().players.map(()=>({x:0,y:0,jump:false}));a[0].x=x;a[0].y=y;window.__hoopsim.inputs(a)}''',[x,y])
 # Let AI win a normal possession away from #45; the idle is an actual in-game pose.
 for k in range(300):
  s=snap()
  if s['phase']=='jeu' and s['holder'] is not None and s['holder']!=0 and s['players'][0]['position']['z']==0:break
  page.evaluate('window.__hoopsim.advance(12)')
 else:raise AssertionError('No idle opportunity')
 page.evaluate('window.__hoopsim.world().controlled=0')
 inputs(.15,.15);page.evaluate('window.__hoopsim.play(true)');page.wait_for_timeout(180);inputs();page.wait_for_timeout(800);page.evaluate('window.__hoopsim.play(false)');idle=snap();assert idle['players'][0]['state']['name']=='idle',idle['players'][0]['state'];assert idle['players'][0]['state']['heading']=='down';assert idle['players'][0]['state']['facing']=='right'
 (out/'45-debout.json').write_text(json.dumps(idle,indent=2));page.locator('canvas').first.screenshot(path=str(out/'45-debout-match.png'));print('Actual idle captured',idle['players'][0],flush=True)
 page.evaluate('window.__hoopsim.inputs(null)')
 for k in range(1500):
  s=snap()
  if s['holder']==0 and s['phase']=='jeu' and not s['players'][0]['position']['z']:break
  page.evaluate('window.__hoopsim.advance(12)')
 else:raise AssertionError('No genuine #45 possession')
 page.evaluate('window.__hoopsim.world().controlled=0');inputs(.1,.1);page.evaluate('window.__hoopsim.play(true)');page.wait_for_timeout(150);inputs();page.wait_for_timeout(250);page.evaluate('window.__hoopsim.play(false)');assert snap()['holder']==0
 page.evaluate('''()=>{window.chunks=[];window.witness=[];window.rec=new MediaRecorder(document.querySelector('canvas').captureStream(30),{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:7000000});window.rec.ondataavailable=e=>window.chunks.push(e.data);window.rec.start(500);window.startTime=performance.now();window.sample=setInterval(()=>window.witness.push({ms:performance.now()-window.startTime,...window.__hoopsim.snapshot()}),33);window.__hoopsim.play(true)}''')
 marks=[]
 def mark(label):
  s=snap();marks.append({'label':label,'ms':page.evaluate('performance.now()-window.startTime'),'step':s['step']})
 page.wait_for_timeout(2000);mark('01-dribble-sur-place');inputs(1,0);page.wait_for_timeout(2500);mark('02-dribble-en-deplacement');inputs();page.wait_for_timeout(2000);mark('03-arret');page.evaluate('window.__hoopsim.play(false);clearInterval(window.sample)')
 with page.expect_download() as download:
  page.evaluate('''async()=>{await new Promise(r=>{window.rec.onstop=r;window.rec.stop()});const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(window.chunks,{type:'video/webm'}));a.download='45.webm';a.click()}''')
 download.value.save_as(out/'45-dribble-deplacement-arret.webm');trace=page.evaluate('window.witness');(out/'trace-match.json').write_text(json.dumps({'marks':marks,'samples':trace,'errors':errors},indent=2));(out/'entrees-match.json').write_text(json.dumps(page.evaluate('window.__hoopsim.recording()')))
 assert all(s['holder']==0 for s in trace),'Possession lost during witness';assert not errors,errors
 b.close()
 subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(out/'45-dribble-deplacement-arret.webm'),'-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-r','30','-movflags','+faststart',str(out/'45-dribble-deplacement-arret.mp4')],check=True)
 for index,label in enumerate(['01-dribble-sur-place','02-dribble-en-deplacement','03-arret']):
  begin=0 if index==0 else marks[index-1]['ms'];end=marks[index]['ms'];subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',str((begin+end)/2000),'-i',str(out/'45-dribble-deplacement-arret.mp4'),'-frames:v','1',str(out/(label+'.png'))],check=True)
 print('GM → actual match → normal-speed stationary/move/stop captured; no browser errors.',flush=True)
