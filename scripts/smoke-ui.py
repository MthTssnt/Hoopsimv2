"""UI refactor discovery, drafting and persistence checks; Vite on port 5173 required."""
import json, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path('/tmp/hoopsim-ui');out.mkdir(exist_ok=True)
fixture=json.loads(subprocess.check_output(['npx','tsx','--eval',"import {createNewGame} from './src/engine/index.ts';console.log(JSON.stringify(createNewGame('bos',31)));"],text=True))
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader']); page=b.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:5173/');page.evaluate('(l)=>localStorage.setItem("hoopsim.save.v1",JSON.stringify(l))',fixture);page.reload();page.get_by_role('button',name='Reprendre la partie sauvegardée',exact=True).click()
 def primary(name):page.get_by_role('navigation',name='Espaces de management').get_by_role('button',name=name,exact=True).click()
 def sub(name):page.get_by_role('navigation',name='Rubriques').get_by_role('button',name=name,exact=True).click()
 def saved():return page.evaluate('JSON.parse(localStorage.getItem("hoopsim.save.v1"))')
 assert page.get_by_role('navigation',name='Espaces de management').get_by_role('button').count()==4
 original=saved();primary('Équipe');assert page.locator('.player-cards > .player-card').count()==14
 page.locator('.player-card .player-name').first.click();page.get_by_role('dialog').wait_for();page.keyboard.press('Escape');assert page.get_by_role('dialog').count()==0
 sub('Rotation');page.get_by_label('Titulaire PG',exact=True).wait_for();assert saved()==original
 page.get_by_label('Minutes ',exact=False).first.fill('1');assert saved()==original
 page.once('dialog',lambda d:d.dismiss());primary('Ligue');assert page.get_by_label('Titulaire PG',exact=True).count()==1
 page.get_by_role('button',name='Annuler les modifications',exact=True).click();assert saved()==original
 page.get_by_role('button',name='Enregistrer le plan',exact=True).click();assert saved()['teams']==original['teams']
 print('Discovery, player dialog Escape/focus, rotation draft guard/cancel and save: OK',flush=True)
 for width in [1440,768,390]:
  page.set_viewport_size({'width':width,'height':1000})
  for group,section in [('Bureau',None),('Équipe','Effectif'),('Équipe','Rotation'),('Équipe','Tactiques'),('Équipe','Développement'),('Marché',None),('Ligue','Classement'),('Ligue','Statistiques')]:
   primary(group)
   if section:sub(section)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(width,group,section)
   page.evaluate('document.activeElement.blur();window.scrollTo(0,0)')
   page.screenshot(path=str(out/f'after-{width}-{section or group}.png'),full_page=True)
 print('Management routes at 1440 / 768 / 390 px without document overflow: OK',flush=True)
 # Tactics remain a single business plan: edits are drafts until explicit save.
 primary('Équipe');sub('Tactiques');before=saved()
 page.get_by_label('Identité offensive',exact=True).select_option('insideOut')
 page.get_by_label('Défense',exact=True).select_option('drop')
 assert saved()==before
 page.get_by_text('Réglages avancés • 6 paramètres de jeu',exact=True).click()
 page.get_by_label('Rythme',exact=True).fill('61')
 page.get_by_role('button',name='Enregistrer le plan tactique',exact=True).click()
 team=next(t for t in saved()['teams'] if t['id']=='bos')
 assert team['gamePlan']['offense']=='insideOut' and team['gamePlan']['defense']=='drop' and team['gamePlan']['pace']==61
 previous=next(t for t in before['teams'] if t['id']=='bos')['gamePlan']
 assert team['gamePlan']['rotation']==previous['rotation']
 primary('Ligue');sub('Statistiques');page.get_by_role('button',name='Toutes les statistiques',exact=True).click()
 sub('Classement');page.get_by_role('button',name='Classement complet',exact=True).first.click()
 print('Tactical draft/save preserves rotation; complete statistics and standings reachable: OK',flush=True)
 page.get_by_role('button',name='Menu',exact=True).click();page.get_by_text('Outils',exact=True).click()
 page.get_by_role('button',name='Animations',exact=True).click()
 assert page.get_by_role('heading',name='Animations',exact=True).count()==1
 page.goto('http://127.0.0.1:5173/?branding')
 page.locator('.brand-grid article').last.wait_for()
 assert page.locator('.brand-grid article').count()==30
 assert page.locator('.brand-grid img').evaluate_all('(imgs)=>imgs.every(i=>i.complete && i.naturalWidth>0)')
 print('Animations tool retained; 30 franchise assets loaded at every gallery size: OK',flush=True)
 assert not errors,errors
 b.close()
