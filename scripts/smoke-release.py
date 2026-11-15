"""Responsive management, keyboard tables, actual storage failures and a real keyboard GM match."""
import json, math, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
fixture=json.loads(subprocess.check_output(['npx','tsx','--eval',"import {createNewGame} from './src/engine/index.ts';console.log(JSON.stringify(createNewGame('bos',31)));"],cwd=root,text=True))
Path('/tmp/hoopsim-evidence').mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader'])
 context=b.new_context(viewport={'width':1280,'height':900},accept_downloads=True)
 page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def load_fixture(url='http://127.0.0.1:5173/'):
  page.goto(url,wait_until='networkidle');page.evaluate('(l)=>localStorage.setItem("hoopsim.save.v1",JSON.stringify(l))',fixture)
  page.reload(wait_until='networkidle');page.get_by_role('button',name='Reprendre la partie sauvegardée',exact=True).click()
 def saved():return page.evaluate("JSON.parse(localStorage.getItem('hoopsim.save.v1'))")
 load_fixture()
 for width in [1280,768,390]:
  page.set_viewport_size({'width':width,'height':900})
  for tab in ['Effectif','Tactiques','Marché','Développement']:
   page.get_by_role('button',name=tab,exact=True).click()
   dimensions=page.evaluate('({width:innerWidth,body:document.documentElement.scrollWidth})')
   assert dimensions['body']<=width+1,(tab,width,dimensions)
   active=page.locator('.nav button[aria-current=page]').bounding_box()
   assert active['x']>=-1 and active['x']+active['width']<=width+1,(tab,width,active)
  table=page.get_by_role('region',name='Tableau de développement').first
  if width==390:
   table.focus();before=table.evaluate('(e)=>e.scrollLeft');page.keyboard.press('ArrowRight');page.wait_for_timeout(250)
   assert table.evaluate('(e)=>e.scrollLeft')>before
   page.screenshot(path='/tmp/hoopsim-evidence/release-mobile-training.png')
  print('Menus sans débordement global, largeur',width,'OK',flush=True)
 page.set_viewport_size({'width':1280,'height':900})
 # An actual failure of the browser storage API, not a message injected into React.
 old=page.evaluate('localStorage.getItem("hoopsim.save.v1")')
 page.evaluate('''()=>{window.failSave=true;const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(window.failSave)throw new DOMException('Quota exceeded','QuotaExceededError');return original.call(this,k,v);};}''')
 page.get_by_label('Focus ',exact=False).first.select_option('shooting')
 page.get_by_role('alert').filter(has_text='Sauvegarde impossible').wait_for()
 assert page.evaluate('localStorage.getItem("hoopsim.save.v1")')==old
 with page.expect_download() as download:
  page.get_by_role('button',name='Exporter la partie',exact=True).click()
 exported=json.load(open(download.value.path()))
 pid=next(t for t in fixture['teams'] if t['id']=='bos')['roster'][0]
 assert exported['players'][pid]['training']['focus']=='shooting'
 page.get_by_role('button',name='Réessayer la sauvegarde',exact=True).click()
 assert page.get_by_role('alert').filter(has_text='Sauvegarde impossible').count()==1
 page.evaluate('window.failSave=false')
 page.get_by_role('button',name='Réessayer la sauvegarde',exact=True).click()
 assert page.get_by_role('alert').filter(has_text='Sauvegarde impossible').count()==0
 assert saved()==exported
 print('Quota réel signalé, ancienne sauvegarde préservée, export mémoire et réessai: OK',flush=True)
 # Draft at narrow width, reached through genuine season/playoff controls.
 page.get_by_role('button',name='Fin de saison',exact=True).click();page.get_by_role('button',name='Simuler les playoffs',exact=True).click()
 page.get_by_role('banner').get_by_role('button',name='Préparer la draft',exact=True).click();page.get_by_role('main').get_by_role('button',name='Préparer la draft',exact=True).click()
 page.set_viewport_size({'width':390,'height':900})
 assert page.evaluate('document.documentElement.scrollWidth')<=391
 assert len(saved()['offseason']['prospects'])==60
 page.screenshot(path='/tmp/hoopsim-evidence/release-mobile-draft.png')
 print('Draft consultable à 390 px: OK',flush=True)
 context.close()
 # Bad save is kept intact and its load error is visible on the starting screen.
 context=b.new_context(viewport={'width':1280,'height':900});page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:5173/',wait_until='networkidle');page.evaluate("localStorage.setItem('hoopsim.save.v1','{invalide')")
 page.reload(wait_until='networkidle');page.get_by_role('button',name='Reprendre la partie sauvegardée',exact=True).click()
 page.get_by_role('alert').filter(has_text='Chargement impossible').wait_for()
 assert page.evaluate('localStorage.getItem("hoopsim.save.v1")')=='{invalide'
 print('Import corrompu visible, contenu conservé: OK',flush=True)
 context.close()
 # Same real career, real GM Jouer, native keyboard events and physical finish.
 context=b.new_context(viewport={'width':1440,'height':1000});page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 load_fixture('http://127.0.0.1:5173/?qt=1&atelier')
 if page.get_by_role('button',name='Jouer',exact=True).count()==0:page.get_by_role('button',name='Passer au match suivant',exact=False).first.click()
 page.get_by_role('button',name='Jouer',exact=True).first.click()
 page.wait_for_function('window.__hoopsim !== undefined',timeout=120000)
 for _ in range(15):
  if page.evaluate('window.__hoopsim.snapshot().phase')=='jeu':break
  page.evaluate('window.__hoopsim.advance(240)')
 assert page.evaluate('window.__hoopsim.snapshot().phase')=='jeu'
 before=page.evaluate('window.__hoopsim.snapshot()');pid=before['players'][before['controlled']]['id'];position=before['players'][before['controlled']]['position']
 page.evaluate('window.__hoopsim.play(true)');page.keyboard.down('z');page.wait_for_timeout(900);page.keyboard.up('z');page.evaluate('window.__hoopsim.play(false)')
 after=page.evaluate('window.__hoopsim.snapshot()');end=next(p['position'] for p in after['players'] if p['id']==pid)
 distance=math.hypot(end['x']-position['x'],end['y']-position['y']);assert distance>0.2,distance
 # Observe native inputs in the existing fixed-step recorder; do not inject movement commands.
 for key,field,value in [('q','x',-1),('s','y',1),('d','x',1),('e','pass',True),('a','steal',True),('Space','release',True)]:
  snapshot=page.evaluate('window.__hoopsim.snapshot()');controlled=snapshot['controlled'];start=snapshot['step']
  page.evaluate('window.__hoopsim.play(true)');page.keyboard.down(key);page.wait_for_timeout(140);page.keyboard.up(key);page.wait_for_timeout(100);page.evaluate('window.__hoopsim.play(false)')
  trace=page.evaluate('window.__hoopsim.recording().steps')
  assert any(step[controlled].get(field)==value for step in trace[start:]),(key,field)
 print('Entrées clavier natives Z/Q/S/D, E passe, A interception et relâchement Espace enregistrés: OK',flush=True)
 page.get_by_role('button',name='Pause',exact=False).first.click()
 assert page.get_by_label('Coaching du match',exact=True).count()==0
 page.get_by_role('button',name='Reprendre',exact=True).click()
 page.evaluate('window.__hoopsim.play(true)');page.wait_for_timeout(350)
 page.get_by_role('button',name='Pause',exact=False).first.click();page.get_by_role('button',name='Simuler la fin',exact=True).click()
 page.get_by_text('Analyse tactique',exact=True).wait_for(timeout=120000)
 final=saved();boxes=list(final['boxScores'].values());box=boxes[-1]
 assert box['tactics']['source']=='physical'
 for tid,rows in box['rows'].items():assert sum(r['line']['pts'] for r in rows)==(box['homeScore'] if tid==box['homeId'] else box['awayScore'])
 assert next(t for t in final['teams'] if t['id']=='bos')['wins']+next(t for t in final['teams'] if t['id']=='bos')['losses']==1
 assert not errors,errors
 print('Jouer au clavier, déplacement',round(distance,2),'m, pause/reprise, fin physique et résultat unique: OK; pageerrors=0',flush=True)
 context.close();b.close()
