"""Browser regression checks; run against npm run dev with Playwright Python and Chromium installed."""
import os
from pathlib import Path
Path(os.environ.get('HOOPSIM_EVIDENCE_DIR', '/tmp/hoopsim-reconstruction')).mkdir(parents=True, exist_ok=True)
import json
from playwright.sync_api import sync_playwright
out=Path(os.environ.get('HOOPSIM_EVIDENCE_DIR', '/tmp/hoopsim-reconstruction'));out.mkdir(parents=True,exist_ok=True);report={'errors':[]}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 ctx=b.new_context(viewport={'width':1280,'height':720})
 page=ctx.new_page();page.on('pageerror',lambda e:report['errors'].append(str(e)))
 def load(seed=8126,extra=''):
  page.goto(f'http://127.0.0.1:5173/?court&seed={seed}&watch&atelier{extra}',wait_until='networkidle')
  page.wait_for_function('!!window.__hoopsim',timeout=120000)
 def snap():return page.evaluate('window.__hoopsim.snapshot()')
 def stable(s):return {k:s[k] for k in ['step','clock','score','holder','controlled','phase','players','boxPoints','lineupVersion','netPassages']}
 load();initial=snap();assert initial['step']==0 and initial['audio']['state']=='locked'
 report['worker']=initial['preparation']; assert report['worker']['mode']=='worker' and report['worker']['prepared']==20
 page.get_by_role('button',name='Avancer de 1/60 s').click();assert abs(snap()['clock']-1/60)<1e-10
 page.evaluate('window.__hoopsim.advance(598)');reference=stable(snap());recording=page.evaluate('window.__hoopsim.recording()')
 assert len(recording['steps'])==600 and not recording['truncated']
 (out/'inputs-8126.json').write_text(json.dumps(recording))
 page.screenshot(path=str(out/'inspector-final.png'))
 load(extra='&sansWorker');report['fallback']=snap()['preparation'];assert report['fallback']['mode']=='main'
 page.evaluate('(steps)=>{for(const inputs of steps)window.__hoopsim.step(inputs)}',recording['steps'])
 assert stable(snap())==reference,'replay diverges across worker/fallback'
 report['replay']={'steps':600,'dt':recording['dt'],'equal':True}
 print('Worker/fallback and exact-input replay OK',flush=True)
 # A full 4 x 3-minute match, every physics callback, accelerated inspection (not a performance measurement).
 load();loops=0
 while not snap()['matchOver'] and loops<70:
  page.evaluate('window.__hoopsim.advance(3600)');loops+=1
  if loops%10==0:print('Full match:',loops*3600,'steps',flush=True)
 full=snap();assert full['matchOver'],full['phase'];assert full['score']==full['boxPoints']
 assert full['preparation']['syncEntries']==0 and full['lineupVersion']>0
 assert full['netPassages']['left']>0 and full['netPassages']['right']>0
 report['full_match']={k:full[k] for k in ['step','clock','score','boxPoints','playersUsed','lineupVersion','netPassages','preparation']}
 page.screenshot(path=str(out/'full-match.png'));print('Full match OK',json.dumps(report['full_match']),flush=True)
 # Real-time x1, then x2/x4, on two more seeds; samples are not full matches.
 report['seeds']=[]
 for seed in [31,919]:
  load(seed);page.get_by_role('button',name='Lire le match',exact=True).click();page.wait_for_timeout(7000)
  for speed in [2,4]:page.get_by_role('button',name=f'×{speed}',exact=True).click();page.wait_for_timeout(1500)
  page.evaluate('window.__hoopsim.play(false)');s=snap();assert s['step']>0 and s['audio']['state']=='running'
  report['seeds'].append({'seed':seed,'clock':s['clock'],'audio':s['audio'],'performance':s['performance']})
  page.get_by_role('button',name='⚙ Paramètres').click();page.get_by_label('Couper le son',exact=True).check()
  muted=snap()['audio'];assert muted['muted'];before=muted['played']
  page.evaluate('window.__hoopsim.play(true)');page.wait_for_timeout(800);page.evaluate('window.__hoopsim.play(false)')
  assert snap()['audio']['played']==before
  page.get_by_label('Couper le son',exact=True).uncheck();page.get_by_role('button',name='Fermer',exact=True).click()
 # Keyboard path, still using the inspector to record inputs at physical step boundaries.
 page.goto('http://127.0.0.1:5173/?court&seed=8126&atelier',wait_until='networkidle');page.wait_for_function('!!window.__hoopsim',timeout=120000)
 page.get_by_role('button',name='Lire le match',exact=True).click();page.keyboard.down('d');page.wait_for_timeout(1200);page.keyboard.up('d');page.keyboard.press('e');page.keyboard.down('Space');page.wait_for_timeout(600);page.keyboard.up('Space');page.wait_for_timeout(300);page.evaluate('window.__hoopsim.play(false)')
 inputs=page.evaluate('window.__hoopsim.recording().steps');assert any(any(i.get('x')==1 for i in row) for row in inputs)
 report['keyboard_recorded']=len(inputs)
 for width,height in [(1280,720),(1920,1080)]:
  page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(300);page.screenshot(path=str(out/f'match-{width}.png'))
 # Atelier's actual selector and archived sources both load; witness assets remain accessible.
 page.goto('http://127.0.0.1:5173/?anims',wait_until='networkidle');page.get_by_label('Vue des animations').wait_for()
 for view in ['match','source']:
  page.get_by_label('Vue des animations').select_option(view);page.get_by_role('button',name='Tir en suspension',exact=False).click();page.wait_for_timeout(200);page.screenshot(path=str(out/f'atelier-{view}.png'))
 assert not report['errors'],report['errors']
 ctx.close();b.close()
(out/'validation.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2),flush=True)
