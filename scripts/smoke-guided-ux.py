"""Real decisions through contextual routes. Uses an isolated browser career."""
import json,subprocess,copy
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1];out=Path('/tmp/hoopsim-ux');out.mkdir(exist_ok=True)
f=json.loads(subprocess.check_output(['npx','tsx','scripts/smoke-guided-fixture.ts'],cwd=root,text=True))
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def load(league=f['league']):
  page.goto('http://127.0.0.1:5173/');page.evaluate('(l)=>localStorage.setItem("hoopsim.save.v1",JSON.stringify(l))',league);page.reload();page.get_by_role('button',name='Reprendre la partie sauvegardée',exact=True).click()
 def saved():return page.evaluate('JSON.parse(localStorage.getItem("hoopsim.save.v1"))')
 def primary(name):page.get_by_role('navigation',name='Espaces de management').get_by_role('button',name=name,exact=True).click()
 load();before=saved()
 if not page.get_by_role('button',name='Prolonger '+f['name'],exact=True).is_visible():page.locator('summary').filter(has_text='Toutes les décisions').click()
 page.get_by_role('button',name='Prolonger '+f['name'],exact=True).click()
 assert page.get_by_label('Joueur à négocier',exact=True).input_value()==f['playerId']
 assert saved()==before
 page.screenshot(path=str(out/'extension-01-editor.png'),full_page=True)
 initial_salary=page.get_by_label('Salaire proposé',exact=True).input_value()
 page.get_by_label('Salaire proposé',exact=True).fill('0.1');assert page.get_by_role('button',name='Vérifier le contrat',exact=True).is_disabled();assert saved()==before
 page.get_by_label('Salaire proposé',exact=True).fill(initial_salary)
 page.get_by_role('button',name='Vérifier le contrat',exact=True).click();assert saved()==before
 page.get_by_role('button',name='Confirmer le contrat',exact=True).click()
 result=saved();assert result['players'][f['playerId']]['extension'];assert result['players'][f['playerId']]['contract']==before['players'][f['playerId']]['contract']
 assert len([t for t in result['management']['transactions'] if t['type']=='extend'])==1
 page.get_by_role('button',name='Voir le contrat signé',exact=True).click();assert '2027' in page.get_by_role('dialog').inner_text();page.screenshot(path=str(out/'extension-02-signed.png'),full_page=True);page.keyboard.press('Escape')
 page.get_by_role('button',name='Retour à mes décisions',exact=True).last.click();assert page.get_by_role('button',name='Prolonger '+f['name'],exact=True).count()==0
 print('Accueil → éditeur prérempli en 1 clic → refus sans mutation → vérifier → confirmer → contrat futur et transaction uniques → fiche signée 2027 → tâche retirée: OK',flush=True)
 # Second route: same market area, player sheet changes its subview.
 primary('Marché');page.get_by_role('button',name='Recruter',exact=True).click()
 team=next(t for t in result['teams'] if t['id']=='bos');pid=next(i for i in team['roster'] if result['players'][i]['contract']['years']==1 and not result['players'][i].get('extension'))
 name=result['players'][pid]['firstName']+' '+result['players'][pid]['lastName']
 page.get_by_label('Rechercher un joueur',exact=True).fill(name);page.get_by_role('button',name=name,exact=True).click();page.get_by_role('button',name='Prolonger son contrat',exact=True).click();assert page.get_by_label('Joueur à négocier',exact=True).input_value()==pid
 print('Marché déjà ouvert → fiche joueur → Contrats pour le bon ID: OK',flush=True)
 page.get_by_role('button',name='Que voulez-vous faire ?',exact=True).click();page.get_by_role('button',name='Choisir mon cinq majeur',exact=True).click()
 before=saved();page.get_by_label('Minutes ',exact=False).first.fill('1')
 page.get_by_role('button',name='Que voulez-vous faire ?',exact=True).click();page.once('dialog',lambda d:d.dismiss());page.get_by_role('button',name='Changer mes tactiques',exact=True).click()
 assert page.get_by_label('Minutes ',exact=False).first.input_value()=='1' and saved()==before
 page.get_by_role('button',name='Annuler les modifications',exact=True).click()
 print('Lanceur depuis un brouillon de rotation : refus de quitter conserve champs et carrière: OK',flush=True)
 # Empty and closed-market states do not silently select a free agent.
 empty=copy.deepcopy(f['league']);own=next(t for t in empty['teams'] if t['id']=='bos')
 for pid in own['roster']:empty['players'][pid]['contract']['years']=2
 load(empty);page.get_by_role('button',name='Que voulez-vous faire ?',exact=True).click();page.get_by_role('button',name='Prolonger un contrat',exact=True).click()
 assert page.get_by_label('Joueur à négocier',exact=True).input_value()==''
 assert page.get_by_text('Aucun contrat à prolonger actuellement.',exact=False).count()==1
 closed=copy.deepcopy(f['league']);closed['phase']='playoffs';load(closed)
 primary('Équipe');page.get_by_role('navigation',name='Rubriques').get_by_role('button',name='Effectif',exact=True).click();page.locator('.player-cards .player-name').filter(has_text=f['name']).click();page.get_by_role('button',name='Prolonger son contrat',exact=True).click()
 assert page.get_by_role('alert').filter(has_text='Signatures fermées').count()==1
 assert page.get_by_role('button',name='Vérifier le contrat',exact=True).is_disabled()
 print('Aucune prolongation et marché fermé : pas de sélection arbitraire ni de signature possible, raison affichée: OK',flush=True)
 # Both choices on an actual proposal generated by runFrontOffices.
 pf=json.loads(subprocess.check_output(['npx','tsx','scripts/smoke-guided-fixture.ts','--proposal'],cwd=root,text=True));proposal=pf['proposal']
 for accept in [False,True]:
  load(pf['league']);before=saved();page.locator('summary').filter(has_text='Toutes les décisions').click();page.locator('[data-task-id="proposal:'+proposal['id']+'"]').get_by_role('button').click()
  target=page.get_by_role('region',name='Décision sur l’offre ciblée')
  assert target.locator('[data-proposal-id="'+proposal['id']+'"]').count()==1
  if accept:page.once('dialog',lambda d:d.accept())
  target.get_by_role('button',name='Accepter l’offre' if accept else 'Refuser l’offre',exact=True).click()
  result=saved();assert not any(x['id']==proposal['id'] for x in result['management']['proposals'])
  if not accept:assert result['players']==before['players'] and result['teams']==before['teams']
  else:
   for pid in proposal['offer']['outgoingIds']:assert result['players'][pid]['teamId']=='bos'
   for pid in proposal['offer']['incomingIds']:assert result['players'][pid]['teamId']==proposal['offer']['fromTeamId']
 print('Offre CPU réelle → carte ciblée en premier → refus sans changement d’effectif et acceptation avec transfert réel: OK',flush=True)
 # Pagination and sheet roundtrip preserve filters without editing the career.
 load();primary('Marché');before=saved();assert page.locator('.player-cards > article').count()<=12
 names=page.locator('.player-cards .player-name').all_text_contents();page.get_by_role('button',name='Joueurs suivants',exact=True).click();assert page.locator('.player-cards .player-name').all_text_contents()!=names
 page.get_by_role('button',name='Joueurs précédents',exact=True).click();assert page.locator('.player-cards .player-name').all_text_contents()==names
 query=names[0];page.get_by_label('Rechercher un joueur',exact=True).fill(query);page.get_by_role('button',name=query,exact=True).click();page.keyboard.press('Escape');assert page.get_by_label('Rechercher un joueur',exact=True).input_value()==query and saved()==before
 print('Recherche paginée 12/page et retour fiche : filtres conservés, aucune mutation: OK',flush=True)
 # A memory mutation must not be reported as a persisted save when storage throws.
 load();before=saved();page.get_by_role('button',name='Prolonger '+f['name'],exact=True).click()
 page.evaluate("()=>{Storage.prototype.setItem=function(){throw new DOMException('Quota exceeded','QuotaExceededError')};}")
 page.get_by_role('button',name='Vérifier le contrat',exact=True).click();page.get_by_role('button',name='Confirmer le contrat',exact=True).click()
 assert saved()==before
 assert page.get_by_role('alert').filter(has_text='Appliqué en mémoire').count()>=1
 page.get_by_role('button',name='Voir le contrat signé',exact=True).click();assert '2027' in page.get_by_role('dialog').inner_text()
 print('Prolongation appliquée en mémoire avec quota en échec : ancien stockage préservé et persistance non annoncée: OK',flush=True)
 assert not errors,errors
 b.close()
