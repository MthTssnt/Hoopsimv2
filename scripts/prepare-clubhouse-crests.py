"""Pack illustrated crests into editable pixel SVGs, with compact variants and canonical palettes."""
from pathlib import Path
from PIL import Image
from collections import deque
import json,subprocess,sys
teams=json.loads(subprocess.check_output(['npx','tsx','--eval',"import {TEAM_SEEDS} from './src/engine/teamsData.ts'; console.log(JSON.stringify(TEAM_SEEDS))"],text=True))
root=Path('src/assets/branding/teams');(root/'small').mkdir(exist_ok=True)
im=Image.open('src/assets/branding/clubhouse-sources/crests.png').convert('RGBA')
def color(hex):return tuple(int(hex[i:i+2],16) for i in [1,3,5])
def svg(c,t):
 palette=[color(t['colors']['primary']),color(t['colors']['secondary']),(255,242,211),(16,34,37)]
 parts=[];p=c.load();w,h=c.size
 for y in range(h):
  x=0
  while x<w:
   start=x;v=p[x,y]
   if v[3]>160:
    c0=min(palette,key=lambda c:sum((a-b)**2 for a,b in zip(c,v[:3])));v=(*c0,255)
   else:v=(0,0,0,0)
   x+=1
   while x<w:
    q=p[x,y];q=(*min(palette,key=lambda c:sum((a-b)**2 for a,b in zip(c,q[:3]))),255) if q[3]>160 else (0,0,0,0)
    if q!=v:break
    x+=1
   if v[3]:parts.append(f'<rect x="{start}" y="{y}" width="{x-start}" height="1" fill="#{v[0]:02x}{v[1]:02x}{v[2]:02x}"/>')
 return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" shape-rendering="crispEdges"><metadata>{t["id"]} {t["colors"]["primary"]} {t["colors"]["secondary"]}</metadata>'+''.join(parts)+'</svg>'
for i,t in enumerate(teams):
 if '--pilots' in sys.argv and t['id'] not in ['bos','nyk']:continue
 x=i%5;y=i//5;c=im.crop((round(x*im.width/5),round(y*im.height/6),round((x+1)*im.width/5),round((y+1)*im.height/6)))
 # Keep only the connected illustrated emblem, excluding generated alpha-edge speckles.
 p=c.load();seen=set();groups=[]
 for yy in range(c.height):
  for xx in range(c.width):
   if p[xx,yy][3]<180 or (xx,yy) in seen:continue
   q=deque([(xx,yy)]);seen.add((xx,yy));g=[]
   while q:
    a,b=q.popleft();g.append((a,b))
    for v in [(a-1,b),(a+1,b),(a,b-1),(a,b+1)]:
     if 0<=v[0]<c.width and 0<=v[1]<c.height and v not in seen and p[v[0],v[1]][3]>=180:seen.add(v);q.append(v)
   groups.append(g)
 keep=set(max(groups,key=len))
 for yy in range(c.height):
  for xx in range(c.width):
   if (xx,yy) not in keep:p[xx,yy]=(0,0,0,0)
 box=c.getbbox();c=c.crop(box)
 for size,folder in [(64,root),(32,root/'small')]:
  scale=min((size-4)/c.width,(size-4)/c.height);r=c.resize((round(c.width*scale),round(c.height*scale)),Image.Resampling.NEAREST);tile=Image.new('RGBA',(size,size));tile.alpha_composite(r,((size-r.width)//2,(size-r.height)//2));(folder/f'{t["id"]}.svg').write_text(svg(tile,t))
print('Clubhouse crests:', '2 pilots' if '--pilots' in sys.argv else '30 franchises', '× detailed/compact')

subprocess.run([sys.executable,'scripts/clean-clubhouse-pilot-crests.py'],check=True)
