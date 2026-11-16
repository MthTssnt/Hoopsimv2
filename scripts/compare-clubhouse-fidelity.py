"""Comparison figures. Never resize each subject from its bounding box to make them match."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image,ImageDraw,ImageFont
import base64,json,shutil
root=Path(__file__).resolve().parents[1];out=root/'docs/validation/clubhouse-fidelity';ref=Path('/workspace/clubhouse-reference/references')
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
def f(n):return ImageFont.truetype(font,n)
def pair(a,b,file,title,note,l='Référence du kit',r='Capture du jeu'):
 w=a.width*2+72;h=a.height+152;c=Image.new('RGB',(w,h),'#f2e8d1');d=ImageDraw.Draw(c);d.text((24,12),title,font=f(24),fill='#173e2d');d.text((24,55),l,font=f(18),fill='#173e2d');d.text((a.width+48,55),r,font=f(18),fill='#173e2d');c.paste(a,(24,88));c.paste(b,(a.width+48,88));d.text((24,h-44),note,font=f(15),fill='#173e2d');c.save(out/file)
# Use the same connected-background cutout as the original UI import; no repainting.
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page();page.goto('http://127.0.0.1:5173/')
 data=page.evaluate('''async()=>{const {referenceCutout}=await import('/src/match/render/sprites/reference45.ts');const result={};for(const kind of ['sprite','portrait']){const {default:url}=await import(`/src/assets/players/clubhouse/reference/${kind}-45.png?url`);const im=new Image();im.src=url;await im.decode();result[kind]=referenceCutout(im,kind).toDataURL();}return result}''')
 for kind,url in data.items():(out/('reference-'+kind+'-detouree.png')).write_bytes(base64.b64decode(url.split(',')[1]))
 b.close()
s=json.loads((out/'45-debout.json').read_text());body=s['players'][0];cam=s['camera'];zoom=cam['zoom'];render=cam['renderScale'];feet=body['feet'];x=(feet['x']-cam['left'])*cam['screenZoom'];y=(feet['y']-cam['top'])*cam['screenZoom']
# 128 x 128 camera pixels, feet at (64,112). Same magnification on both sides.
actual=Image.open(out/'45-debout-match.png').crop((round(x-64),round(y-112),round(x+64),round(y+16)))
original=Image.open(out/'reference-sprite-detouree.png');height_cm=185;sy=(35+(height_cm-195)*.12)/35;scale=70/original.height*sy*zoom*render/2
reference=Image.new('RGB',(128,128),'#e0bb7b');scaled=original.resize((round(original.width*scale),round(original.height*scale)),Image.Resampling.NEAREST);reference.paste(scaled,(64-scaled.width//2,112-scaled.height),scaled)
reference.save(out/'45-reference-meme-echelle.png');actual.save(out/'45-jeu-meme-echelle.png');pair(reference.resize((512,512),Image.Resampling.NEAREST),actual.resize((512,512),Image.Resampling.NEAREST),'comparaison-45.png','#45 — même pose debout, trois-quarts face vers la droite','Même échelle de caméra ; loupe ×4 commune. Aucun ajustement par boîte englobante.')
metadata={'pose':body['state'],'camera':cam,'heightCm':height_cm,'referenceCrop':{'x':25,'y':51,'w':79,'h':135},'referenceScale':scale,'gameCrop':{'left':round(x-64),'top':round(y-112),'size':128},'commonLoupe':4,'note':'Le jeu conserve son ombre et son indicateur de sélection. La référence est détourée sur fond uni. Le gabarit lourd conserve son élargissement de 4 % au rendu.'};(out/'comparaison-echelle.json').write_text(json.dumps(metadata,indent=2))
# Portrait uses identical source canvas size and orientation, both 96 px before the loupe.
pref=Image.new('RGB',(96,96),'#f1e2c4');portrait=Image.open(out/'reference-portrait-detouree.png');ph=round(portrait.height*96/portrait.width);portrait=portrait.resize((96,ph),Image.Resampling.NEAREST);pref.paste(portrait,(0,96-ph),portrait);game=Image.open(out/'portrait-jeu.png').convert('RGB').resize((96,96),Image.Resampling.NEAREST)
pair(pref.resize((384,384),Image.Resampling.NEAREST),game.resize((384,384),Image.Resampling.NEAREST),'comparaison-portrait.png','Portrait du #45 — cadrage et orientation identiques','96 × 96 pixels par portrait ; loupe ×4 identique. Fond du kit retiré.')
sourceHome=ref/'01-accueil-clubhouse.png';targetHome=out/'franchise-reference.png';
if sourceHome.exists():shutil.copyfile(sourceHome,targetHome)
a=Image.open(out/'franchise-reference.png').convert('RGB');b=Image.open(out/'franchise-jeu.png').convert('RGB');assert a.size==b.size==(1672,941);pair(a,b,'comparaison-franchise.png','Franchise — maquette et interface jouable','Même fenêtre : 1 672 × 941 px. Noms, dates et décision issus de la vraie carrière.')
print('Comparaisons source / match / portrait / Franchise créées à échelle documentée.')
