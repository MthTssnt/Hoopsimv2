"""Pack the artist-drawn dribble variants, preserving the existing simulation pose catalogue."""
from pathlib import Path
from PIL import Image
from collections import deque
import json
root=Path('src/assets/players/clubhouse');old=Image.open(root/'body.png');atlas=Image.new('RGBA',(1536,3840));atlas.paste(old.crop((0,0,1536,3072)),(0,0));manifest=json.loads((root/'manifest.json').read_text());manifest['frames']=manifest['frames'][:128]
im=Image.open(root/'sources/dribble-fidelity.png').convert('RGBA')
for row in range(4):
 for col in range(8):
  tile=im.crop((round(col*im.width/8),round(row*im.height/4),round((col+1)*im.width/8),round((row+1)*im.height/4)))
  p=tile.load();seen=set();groups=[]
  for y in range(tile.height):
   for x in range(tile.width):
    if (x,y) in seen or p[x,y][3]<180:continue
    q=deque([(x,y)]);seen.add((x,y));group=[]
    while q:
     a,b=q.popleft();group.append((a,b))
     for n in [(a-1,b),(a+1,b),(a,b-1),(a,b+1)]:
      if 0<=n[0]<tile.width and 0<=n[1]<tile.height and n not in seen and p[n[0],n[1]][3]>=180:seen.add(n);q.append(n)
    groups.append(group)
  keep=set(max(groups,key=len))
  for y in range(tile.height):
   for x in range(tile.width):p[x,y]=(*p[x,y][:3],255) if (x,y) in keep else (0,0,0,0)
  box=tile.getbbox();sprite=tile.crop(box);sy=70/sprite.height;sx=sy*.88;sprite=sprite.resize((round(sprite.width*sx),70),Image.Resampling.NEAREST)
  # Jersey centroid roots the torso independently of the extended dribbling hand.
  greens=[(x,y) for y in range(70) for x in range(sprite.width) if (lambda r,g,b,a:a and g>r*1.2 and g>b*1.1)(*sprite.getpixel((x,y)))]
  cx=sum(x for x,y in greens)/len(greens);out=Image.new('RGBA',(192,192));ox=round(96-cx);out.alpha_composite(sprite,(ox,99))
  # Ivory band is a stable landmark; retain one shared head module per identity.
  white=[(x,y) for y in range(99,125) for x in range(70,123) if (lambda r,g,b,a:a and r>180 and g>165 and b>115)(*out.getpixel((x,y)))]
  band_y=min(y for x,y in white);near=[(x,y) for x,y in white if y<band_y+5];center=sum(x for x,y in near)/len(near)
  neck=band_y+17;head={'x':round(center-15),'y':neck-30,'w':30,'h':30};erase={'x':round(center-19),'y':band_y-9,'w':38,'h':28}
  skin=[(x,y) for y in range(neck+2,160) for x in range(103,148) if (lambda r,g,b,a:a and r>75 and r>g*1.2 and g>b*1.1)(*out.getpixel((x,y)))]
  edge=max(x for x,y in skin);hand=[(x,y) for x,y in skin if x>=edge-3];hx=sum(x for x,y in hand)/len(hand)/2;hy=sum(y for x,y in hand)/len(hand)/2
  # At the push, fingers are above the ball; at the catch they support its lower side.
  dy=[2,2.5,2.5,2.5,2,0,-2,-1][col];palm=manifest['frames'][(24 if row%2==0 else 40)+col]['palm'];hand={'x':hx,'y':hy}
  index=128+row*8+col;atlas.paste(out,(index%8*192,index//8*192));manifest['frames'].append({'head':head,'erase':erase,'palm':palm,'hand':hand,'contactOffset':dy,'neck':neck})
atlas.save(root/'body.png',optimize=True);(root/'manifest.json').write_text(json.dumps(manifest,separators=(',',':')));print('160 poses: faithful stationary/moving dribble packed, front/back.')
