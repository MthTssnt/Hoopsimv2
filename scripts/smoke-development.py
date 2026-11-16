"""Real UI training + two draft choices, save/load, ready window and new season. Vite must be running."""
import json
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
fixture=json.loads(subprocess.check_output(['npx','tsx','--eval',"import {createNewGame} from './src/engine/index.ts'; console.log(JSON.stringify(createNewGame('bos',31)));"],cwd=root,text=True))
Path('/tmp/hoopsim-evidence').mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=browser.new_page(viewport={'width':1440,'height':1000})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:5173/',wait_until='networkidle')
 page.evaluate('(x)=>localStorage.setItem("hoopsim.save.v1",JSON.stringify(x))',fixture)
 page.reload(wait_until='networkidle');page.get_by_role('button',name='Reprendre',exact=False).first.click()
 def saved():return page.evaluate("JSON.parse(localStorage.getItem('hoopsim.save.v1'))")
 page.get_by_role('navigation',name='Espaces de management').get_by_role('button',name='Équipe',exact=True).click();page.get_by_role('navigation',name='Rubriques').get_by_role('button',name='Développement',exact=True).click()
 focus=page.get_by_label('Focus ',exact=False).first
 player_id=next(t for t in fixture['teams'] if t['id']=='bos')['roster'][0]
 initial_attrs=fixture['players'][player_id]['attrs']
 focus.select_option('shooting');focus.select_option('defense');focus.select_option('shooting')
 assert saved()['players'][player_id]['attrs']==initial_attrs
 assert saved()['players'][player_id]['training']['days']=={}
 page.get_by_role('button',name='Avancer…',exact=True).click();page.once('dialog',lambda d:d.accept());page.get_by_role('button',name='+7 jours',exact=True).click()
 assert saved()['players'][player_id]['training']['days']['shooting']>0
 assert saved()['players'][player_id]['attrs']==initial_attrs
 print('Focus réel enregistré, aucune progression au clic ; exposition après sept journées: OK',flush=True)
 # Complete actual seasons through the existing controls, never forge phase, wins or results.
 page.get_by_role('button',name='Avancer…',exact=True).click();page.once('dialog',lambda d:d.accept());page.get_by_role('button',name='Fin de saison',exact=True).click()
 page.get_by_role('button',name='Avancer…',exact=True).click();page.once('dialog',lambda d:d.accept());page.get_by_role('button',name='Simuler les playoffs',exact=True).click()
 page.get_by_role('banner').get_by_role('button',name='Reprendre l’intersaison',exact=True).click()
 page.get_by_role('button',name='Préparer la draft',exact=True).last.click()
 preview=saved()['offseason'];assert len(preview['prospects'])==60 and preview['cursor']==0
 page.screenshot(path='/tmp/hoopsim-evidence/development-prospects.png')
 if preview['picks'][0]['ownerTeamId']!='bos':page.get_by_role('button',name='Faire avancer les choix CPU',exact=True).click()
 d=saved()['offseason'];assert d['stage']=='draft'
 first_pick=d['picks'][d['cursor']];assert first_pick['ownerTeamId']=='bos'
 page.get_by_role('navigation',name='Espaces de management').get_by_role('button',name='Bureau',exact=True).click();page.get_by_role('button',name='Reprendre la draft',exact=True).click();assert saved()['offseason']['cursor']==d['cursor']
 page.wait_for_timeout(250);page.screenshot(path='/tmp/hoopsim-evidence/development-draft.png',full_page=True)
 age=saved()['players'][player_id]['age'] if player_id in saved()['players'] else None
 page.reload(wait_until='networkidle');page.get_by_role('button',name='Reprendre',exact=False).first.click()
 page.get_by_role('banner').get_by_role('button',name='Reprendre l’intersaison',exact=True).click()
 assert saved()['offseason']['cursor']==d['cursor']
 if age is not None:assert saved()['players'][player_id]['age']==age
 print('Vraie saison/playoffs terminés ; draft suspendue et rechargée sans rejeu: OK',flush=True)
 choices=[]
 while saved()['offseason']['stage']=='draft':
  current=saved()['offseason'];pick=current['picks'][current['cursor']]
  btn=page.get_by_role('button',name='Sélectionner le choix conseillé :',exact=False)
  if btn.count():
   before=set(saved()['players'])
   btn.click()
   result=saved()['offseason']['picks'][current['cursor']]
   assert result['player']['id'] not in before and saved()['players'][result['player']['id']]['teamId']=='bos'
   choices.append(result['player']['name'])
  else:page.get_by_role('button',name='Passer mon choix',exact=True).click()
 assert len(choices)==2,choices
 assert saved()['offseason']['cursor']==60
 page.get_by_role('navigation',name='Espaces de management').get_by_role('button',name='Marché',exact=True).click()
 assert 'agents libres' in page.locator('body').inner_text().lower()
 page.get_by_role('navigation',name='Espaces de management').get_by_role('button',name='Équipe',exact=True).click();page.get_by_role('navigation',name='Rubriques').get_by_role('button',name='Développement',exact=True).click()
 page.get_by_role('button',name='Lancer la saison 2027',exact=True).click()
 final=saved();assert final['season']==2027 and final['phase']=='regular' and 'offseason' not in final
 assert final['seasonReviews'][-1]['draft']
 page.get_by_role('button',name='Bilans de saison',exact=True).click()
 assert page.get_by_text('Votre développement',exact=True).count()==1
 page.wait_for_timeout(250);page.screenshot(path='/tmp/hoopsim-evidence/development-review.png',full_page=True)
 assert not errors,errors
 print('Deux choix humains réels, fenêtre agents libres, saison 2027 et bilan archivés: OK',choices,flush=True)
 print('pageerrors=0',flush=True)
 browser.close()
