from pathlib import Path
from playwright.sync_api import sync_playwright
Path('/tmp/hoopsim-evidence').mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1440,'height':1000})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:5173/?qt=1',wait_until='networkidle')
 page.locator('.team-card').filter(has_text='Boston').click()
 page.get_by_role('button',name='Diriger Boston Ironsides').click()
 page.get_by_role('button',name='Tactiques',exact=True).click()
 page.get_by_label('Poids Lecture libre',exact=True).fill('0')
 page.get_by_label('Poids Horns',exact=True).fill('1')
 page.get_by_role('button',name='Enregistrer le plan tactique',exact=True).click()
 if page.get_by_role('button',name='Regarder',exact=True).count()==0:
  page.get_by_role('button',name='Passer au match suivant').or_(page.get_by_role('button',name='Avancer de',exact=False)).first.click()
 page.get_by_role('button',name='Regarder',exact=True).first.click()
 page.locator('canvas').first.wait_for(timeout=60000)
 page.get_by_text('Préparation des joueurs',exact=False).wait_for(state='hidden',timeout=120000)
 page.wait_for_timeout(5000)
 page.screenshot(path='/tmp/hoopsim-evidence/live-horns.png')
 page.get_by_role('button',name='Pause',exact=False).first.click()
 page.get_by_label('Coaching du match',exact=True).wait_for()
 page.get_by_label('Système en match',exact=True).select_option('fiveOut')
 page.get_by_label('Attaque en match',exact=True).select_option('paceSpace')
 page.get_by_label('Défense en match',exact=True).select_option('switch')
 page.get_by_label('Rythme en match',exact=True).fill('80')
 page.get_by_role('button',name='Envoyer les consignes',exact=True).click()
 assert page.get_by_label('État des consignes',exact=True).inner_text().find('en attente')>=0
 # Select a bench player in the PG slot, then use the separate legal-substitution request.
 pg=page.get_by_label('Coach PG',exact=True)
 values=pg.locator('option').evaluate_all('(xs)=>xs.map(x=>x.value)')
 pg.select_option(values[-1])
 page.get_by_role('button',name='Demander ce cinq',exact=True).click()
 page.screenshot(path='/tmp/hoopsim-evidence/live-coach-pause.png',full_page=True)
 page.get_by_role('button',name='Reprendre',exact=True).click()
 page.wait_for_timeout(6000)
 page.get_by_role('button',name='Pause',exact=False).first.click()
 assert page.get_by_label('Attaque en match',exact=True).input_value()=='paceSpace'
 assert 'appliqué' in page.get_by_label('État des consignes',exact=True).inner_text()
 page.get_by_role('button',name='Simuler la fin',exact=True).click()
 page.get_by_text('Analyse tactique',exact=True).wait_for(timeout=120000)
 page.get_by_text('Analyse tactique',exact=True).click()
 assert page.get_by_text('Séquences démarrées',exact=False).count()>0
 saved=page.evaluate("JSON.parse(localStorage.getItem('hoopsim.save.v1'))")
 box=list(saved['boxScores'].values())[-1]
 assert box['tactics']['source']=='physical'
 report=box['tactics']['teams'][saved['userTeamId']]
 assert report['offense']=='paceSpace'
 assert any('appliqué' in e['message'] for e in report['coachingEvents'])
 # Career plan is unchanged: in-match commands are local to the completed match.
 team=next(t for t in saved['teams'] if t['id']==saved['userTeamId'])
 assert team['gamePlan']['offense']=='balanced'
 assert sum(r['line']['pts'] for r in box['rows'][saved['userTeamId']])==(box['homeScore'] if box['homeId']==saved['userTeamId'] else box['awayScore'])
 assert not errors,errors
 page.screenshot(path='/tmp/hoopsim-evidence/live-coach-report.png',full_page=True)
 print('PASS: Regarder, pause coach, consignes et cinq différés, reprise, fin physique, rapport et carrière conservée ; aucune pageerror.')
 print(report['live'], report['coachingEvents'])
 b.close()
