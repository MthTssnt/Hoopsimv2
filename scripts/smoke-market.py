import json
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
fixture=json.loads(subprocess.check_output(['npx','tsx','scripts/smoke-market-fixture.ts'],cwd=Path(__file__).resolve().parents[1],text=True))
Path('/tmp/hoopsim-evidence').mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1440,'height':1000})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:5173/?qt=1',wait_until='networkidle')
 page.evaluate('(x)=>localStorage.setItem("hoopsim.save.v1",JSON.stringify(x))',fixture['league'])
 page.reload(wait_until='networkidle')
 page.get_by_role('button',name='Reprendre',exact=False).first.click()
 page.get_by_role('button',name='Marché',exact=True).click()
 page.get_by_role('button',name='Transferts',exact=True).click()
 before=page.evaluate('localStorage.getItem("hoopsim.save.v1")')
 def choose(x):
  for box in page.get_by_role('checkbox').all():
   if box.is_checked():box.uncheck()
  page.get_by_label('Franchise partenaire',exact=True).select_option(x['offer']['toTeamId'])
  page.get_by_label('Échanger BOS '+x['out'],exact=True).check()
  page.get_by_label('Échanger '+x['other']+' '+x['incoming'],exact=True).check()
 choose(fixture['rejected'])
 page.get_by_role('button',name='Envoyer l’offre',exact=True).click()
 assert page.get_by_role('status').inner_text().find('refuse')>=0
 assert page.evaluate('localStorage.getItem("hoopsim.save.v1")')==before
 print('Refus sans mutation: OK',flush=True)
 choose(fixture['accepted'])
 page.get_by_role('button',name='Envoyer l’offre',exact=True).click()
 assert 'Échange accepté' in page.get_by_role('status').inner_text()
 saved=json.loads(page.evaluate('localStorage.getItem("hoopsim.save.v1")'))
 offer=fixture['accepted']['offer'];out=offer['outgoingIds'][0];inc=offer['incomingIds'][0]
 assert saved['players'][out]['teamId']==offer['toTeamId'] and saved['players'][inc]['teamId']=='bos'
 assert len([e for e in saved['management']['transactions'] if e['type']=='trade'])==1
 print('Transfert appliqué une seule fois: OK',flush=True)
 page.get_by_role('button',name='Joueurs et agents libres',exact=True).click()
 page.get_by_label('Équipe recherchée',exact=True).select_option('free')
 page.get_by_role('button',name='Offrir un contrat',exact=True).first.click()
 pid=page.get_by_label('Joueur à négocier',exact=True).input_value()
 salary=page.get_by_label('Salaire proposé',exact=True).input_value()
 before=page.evaluate('localStorage.getItem("hoopsim.save.v1")')
 page.get_by_label('Salaire proposé',exact=True).fill('0.5')
 page.get_by_role('button',name='Transmettre le contrat',exact=True).click()
 assert page.evaluate('localStorage.getItem("hoopsim.save.v1")')==before
 page.get_by_label('Salaire proposé',exact=True).fill(salary)
 page.get_by_role('button',name='Transmettre le contrat',exact=True).click()
 assert 'Contrat signé' in page.get_by_role('status').inner_text()
 saved=json.loads(page.evaluate('localStorage.getItem("hoopsim.save.v1")'))
 assert saved['players'][pid]['teamId']=='bos'
 print('Signature agent libre + refus du salaire invalide: OK',flush=True)
 team=next(t for t in saved['teams'] if t['id']=='bos')
 ext=next(saved['players'][i] for i in team['roster'] if saved['players'][i]['contract']['years']==1)
 page.get_by_label('Joueur à négocier',exact=True).select_option(ext['id'])
 page.get_by_role('button',name='Transmettre le contrat',exact=True).click()
 assert 'Contrat signé' in page.get_by_role('status').inner_text()
 saved=json.loads(page.evaluate('localStorage.getItem("hoopsim.save.v1")'))
 assert saved['players'][ext['id']]['contract']==ext['contract'] and saved['players'][ext['id']]['extension']
 print('Prolongation différée sans remplacer le contrat courant: OK',flush=True)
 page.reload(wait_until='networkidle')
 page.get_by_role('button',name='Reprendre',exact=False).first.click()
 page.get_by_role('button',name='Marché',exact=True).click()
 page.get_by_role('button',name='Transactions',exact=True).click()
 page.wait_for_timeout(250)
 page.screenshot(path='/tmp/hoopsim-evidence/market-history.png')
 saved=json.loads(page.evaluate('localStorage.getItem("hoopsim.save.v1")'))
 assert saved['players'][ext['id']]['extension'] and saved['players'][pid]['teamId']=='bos'
 assert len([e for e in saved['management']['transactions'] if e['type']=='trade'])==1
 print('Rechargement et historique: OK',flush=True)
 page.get_by_role('button',name='Équipe',exact=True).click() if page.get_by_role('button',name='Équipe',exact=True).count() else page.get_by_role('button',name='Accueil',exact=True).click()
 if page.get_by_role('button',name='Regarder',exact=True).count()==0:
  page.get_by_role('button',name='Passer au match suivant').or_(page.get_by_role('button',name='Avancer de',exact=False)).first.click()
 page.get_by_role('button',name='Regarder',exact=True).first.click()
 page.locator('canvas').first.wait_for(timeout=60000)
 page.get_by_text('Préparation des joueurs',exact=False).wait_for(state='hidden',timeout=120000)
 page.wait_for_timeout(1500)
 page.get_by_role('button',name='Pause',exact=False).first.click()
 page.screenshot(path='/tmp/hoopsim-evidence/market-live.png')
 page.get_by_role('button',name='Simuler la fin',exact=True).click()
 page.get_by_text('Analyse tactique',exact=True).wait_for(timeout=120000)
 final=page.evaluate("JSON.parse(localStorage.getItem('hoopsim.save.v1'))")
 box=list(final['boxScores'].values())[-1]
 assert box['tactics']['source']=='physical'
 for tid,rows in box['rows'].items():
  assert sum(r['line']['pts'] for r in rows)==(box['homeScore'] if tid==box['homeId'] else box['awayScore'])
 assert not errors,errors
 print('Match physique terminé après transfert et signature, pause et comptabilité: OK; pageerrors=0',flush=True)
 b.close()
