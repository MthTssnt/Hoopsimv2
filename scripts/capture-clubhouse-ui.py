"""Capture four real management screens and verify an actual extension in a fresh career."""
from playwright.sync_api import sync_playwright
from pathlib import Path
import json
out=Path(__file__).resolve().parents[1]/'docs/validation/clubhouse';out.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':1280,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:5173/');page.get_by_role('button',name='Découvrir Clubhouse • le #45 à Boston',exact=True).click();page.wait_for_timeout(150);page.evaluate('document.activeElement.blur()');page.screenshot(path=str(out/'franchise.png'),full_page=True)
 page.get_by_role('button',name='Modifier la rotation',exact=True).click();page.evaluate('document.activeElement.blur();window.scrollTo(0,0)');page.screenshot(path=str(out/'equipe.png'),full_page=True)
 page.get_by_role('navigation',name='Espaces de management').get_by_role('button',name='Franchise',exact=True).click();page.get_by_role('button',name='Prolonger Florian Benson',exact=True).click();assert page.get_by_label('Joueur à négocier',exact=True).input_value()=='pk';page.get_by_role('button',name='Vérifier le contrat',exact=True).click();page.evaluate('document.activeElement.blur();window.scrollTo(0,0)');page.screenshot(path=str(out/'contrat.png'),full_page=True);page.get_by_role('button',name='Confirmer le contrat',exact=True).click();page.get_by_role('button',name='Retour à mes décisions',exact=True).last.click();assert page.get_by_role('button',name='Prolonger Florian Benson',exact=True).count()==0
 page.locator('.club-player').first.click();page.get_by_role('button',name='Modifier l’apparence',exact=True).click();page.get_by_role('button',name='Figer',exact=True).click();page.set_viewport_size({'width':1280,'height':1800});page.wait_for_timeout(100);page.screenshot(path=str(out/'atelier.png'),full_page=True)
 page.get_by_role('button',name='Annuler',exact=True).click();page.keyboard.press('Tab');assert page.get_by_role('dialog').evaluate('(el)=>el.contains(document.activeElement)');page.keyboard.press('Escape');page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(100);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=str(out/'mobile.png'),full_page=True)
 page.goto('http://127.0.0.1:5173/?branding');page.set_viewport_size({'width':1440,'height':1000});page.wait_for_timeout(300);page.screenshot(path=str(out/'ecussons.png'),full_page=True)
 assert not errors,errors;b.close();print('Franchise → Rotation → Prolongation effective → Atelier → mobile → 30 écussons : captures réelles sans erreur.')
