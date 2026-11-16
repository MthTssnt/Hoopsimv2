"""Pack artist-drawn transparent cells; integer pixels, no anatomical rotations or AI at runtime."""
from pathlib import Path
from PIL import Image
from collections import deque
import json
root=Path('src/assets/players/clubhouse')
def clean(im):
 im=im.convert('RGBA');w,h=im.size;pix=im.load();seen=set();groups=[]
 for y in range(h):
  for x in range(w):
   if pix[x,y][3]<180 or (x,y) in seen:continue
   q=deque([(x,y)]);seen.add((x,y));group=[]
   while q:
    a,b=q.popleft();group.append((a,b))
    for p in [(a-1,b),(a+1,b),(a,b-1),(a,b+1)]:
     if 0<=p[0]<w and 0<=p[1]<h and p not in seen and pix[p[0],p[1]][3]>=180:seen.add(p);q.append(p)
   groups.append(group)
 if not groups:raise ValueError('Empty art cell')
 main=max(groups,key=len);xs=[p[0] for p in main];ys=[p[1] for p in main];box=(min(xs),min(ys),max(xs)+1,max(ys)+1)
 keep=set(main)
 for g in groups:
  if len(g)>=12 and any(box[0]-6<=x<=box[2]+6 and box[1]-6<=y<=box[3]+6 for x,y in g):keep.update(g)
 for y in range(h):
  for x in range(w):
   if (x,y) not in keep:pix[x,y]=(0,0,0,0)
   else:pix[x,y]=(*pix[x,y][:3],255)
 return im,box
cells=[]
for file,rows in [('locomotion',6),('gestures',8),('shot-block',2)]:
 im=Image.open(root/'sources'/f'{file}.png');w,h=im.size
 columns=[]
 for col in range(8):
  strip=im.crop((round(col*w/8),0,round((col+1)*w/8),h))
  # Generated source grids are not uniform vertically. Find the actual silhouettes first.
  pix=strip.load();seen=set();groups=[]
  for y in range(h):
   for x in range(strip.width):
    if pix[x,y][3]<180 or (x,y) in seen:continue
    q=deque([(x,y)]);seen.add((x,y));group=[]
    while q:
     a,b=q.popleft();group.append((a,b))
     for pt in [(a-1,b),(a+1,b),(a,b-1),(a,b+1)]:
      if 0<=pt[0]<strip.width and 0<=pt[1]<h and pt not in seen and pix[pt[0],pt[1]][3]>=180:seen.add(pt);q.append(pt)
    if len(group)>350:groups.append(group)
  groups=sorted(sorted(groups,key=len,reverse=True)[:rows],key=lambda g:min(y for x,y in g))
  assert len(groups)==rows,(file,col,len(groups))
  limits=[0]+[round((max(y for x,y in a)+min(y for x,y in b))/2) for a,b in zip(groups,groups[1:])]+[h]
  columns.append([clean(strip.crop((0,limits[row],strip.width,limits[row+1]))) for row in range(rows)])
 for row in range(rows):
  reference=columns[0][row][1];target=(60 if row in [4,5] else 64 if row in [6,7] else 70) if file=='gestures' else 64 if file=='shot-block' else 70
  scale=target/(reference[3]-reference[1])
  for col in range(8):
   c,b=columns[col][row];cells.append((c,b,file,row,col,scale))
atlas=Image.new('RGBA',(8*192,16*192));frames=[]
for i,(c,b,file,row,col,scale) in enumerate(cells):
 green=[(x,y) for y in range(c.height) for x in range(c.width) if c.getpixel((x,y))[3] and (lambda r,g,b:g>r*1.1 and g>b*1.1 and g>30)(*c.getpixel((x,y))[:3])]
 if file!='locomotion':
  # Equal body mass, rather than equal bounding height: a raised arm must not shrink the athlete.
  row_width=max(sum(1 for x,gy in green if gy==y) for y in set(gy for x,gy in green))
  scale=16/max(1,row_width)
 cx=sum(x for x,y in green)/max(1,len(green));ground=b[3]-1
 size=(max(1,round(c.width*scale)),max(1,round(c.height*scale)));small=c.resize(size,Image.Resampling.NEAREST)
 out=Image.new('RGBA',(192,192));ox=round(96-cx*scale);oy=round(168-ground*scale);out.alpha_composite(small,(ox,oy))
 contact_greens=[y for x,y in green if abs(x-cx)<(b[2]-b[0])*.18]
 contact_neck=max(96,min(140,round(oy+(min(contact_greens) if contact_greens else b[1]+(b[3]-b[1])*.35)*scale)))
 contact_head={'x':82,'y':contact_neck-26,'w':30,'h':28}
 neck=contact_neck
 neck=max(96,min(140,neck));head={'x':82,'y':neck-26,'w':30,'h':28}
 skin=[];all_skin=[]
 for y in range(65,160):
  for x in range(62,151):
   r,g,bl,a=out.getpixel((x,y))
   if a and r>75 and r>g*1.15 and g>bl*1.12:
    all_skin.append((x,y))
    if not (contact_head['x']-3<=x<=contact_head['x']+contact_head['w']+3 and contact_head['y']-3<=y<=contact_neck+1):skin.append((x,y))
 raised=(file=='shot-block' or file=='gestures' and row//2!=1) and col%4 in [1,2]
 if skin:
  if raised:
   skin=[(x,y) for x,y in all_skin if x>=107] or skin
   edge=min(y for x,y in skin);tip=[(x,y) for x,y in skin if y<=edge+3];dx,dy=1,-2
  else:
   below=[(x,y) for x,y in skin if y>contact_neck+2];skin=below or skin
   edge=max(x for x,y in skin);tip=[(x,y) for x,y in skin if x>=edge-3];dx,dy=3,1
  palm={'x':(sum(x for x,y in tip)/len(tip)+dx)/2,'y':(sum(y for x,y in tip)/len(tip)+dy)/2}
 else:raise ValueError(('Missing hand',i))
 # Locate the ivory band itself: raised arms and V-necks are not reliable head anchors.
 whites={(x,y) for y in range(45,151) for x in range(65,130) if (lambda r,g,b,a:a and r>180 and g>165 and b>115 and r<g*1.25)(*out.getpixel((x,y)))}
 groups=[]
 while whites:
  seed=whites.pop();q=deque([seed]);group=[seed]
  while q:
   x,y=q.popleft()
   for dx,dy in [(-1,0),(1,0),(0,-1),(0,1),(-1,-1),(1,1),(-1,1),(1,-1)]:
    pt=(x+dx,y+dy)
    if pt in whites:whites.remove(pt);q.append(pt);group.append(pt)
  xs=[x for x,y in group];ys=[y for x,y in group];box=(min(xs),min(ys),max(xs)+1,max(ys)+1)
  if box[2]-box[0]>=8 and box[3]-box[1]<=13 and abs((box[0]+box[2])/2-96)<15:groups.append((box,len(group)))
 if not groups:raise ValueError(('Missing ivory headband',i))
 # A forehead band can touch a raised wrist. Horizontal runs plus the dark hair above
 # locate the forehead even when the connected ivory component includes the arm.
 runs=[]
 for yy in range(50,141):
  xx=65
  while xx<130:
   r,g,bl,a=out.getpixel((xx,yy))
   if not (a and r>180 and g>165 and bl>115 and r<g*1.25):xx+=1;continue
   begin=xx;xx+=1
   while xx<130:
    r,g,bl,a=out.getpixel((xx,yy))
    if not (a and r>180 and g>165 and bl>115 and r<g*1.25):break
    xx+=1
   center=(begin+xx)/2
   if xx-begin<5 or abs(center-96)>18:continue
   dark=0;area=0
   for hy in range(max(0,yy-10),yy-1):
    for hx in range(max(0,round(center-8)),min(192,round(center+8))):
     r,g,bl,a=out.getpixel((hx,hy));area+=1
     if a and r<100 and g<95 and bl<90 and r>=g*.95:dark+=1
   if dark/max(1,area)>.38:runs.append((yy,begin,xx))
 if runs:
  by,bx,ex=min(runs);near=[]
  for yy in range(by,min(151,by+7)):
   for xx in range(max(65,bx-10),min(130,ex+10)):
    r,g,bl,a=out.getpixel((xx,yy))
    if a and r>180 and g>165 and bl>115 and r<g*1.25:near.append((xx,yy))
  xs=[x for x,y in near];band=(min(xs),by,max(xs)+1,by+7)
 else:band=min(groups,key=lambda item:item[0][1])[0]
 center=(band[0]+band[2])/2;bw=band[2]-band[0]
 # Anchor the new head at the artist's neck. Keep the source erasure independent:
 # the old head may be larger than the shared portrait module.
 neck=round(band[1]+bw*1.12)
 head={'x':round(center-15),'y':neck-30,'w':30,'h':30}
 erase={'x':round(center-bw*.85-3),'y':round(band[1]-bw*.65),'w':round(bw*1.7+6),'h':round(neck+2-(band[1]-bw*.65))}
 atlas.alpha_composite(out,((i%8)*192,(i//8)*192));frames.append({'head':head,'erase':erase,'palm':palm,'neck':neck})
atlas.save(root/'body.png',optimize=True)
# Head modules use the same shapes for UI portraits and in-match composition.
im=Image.open(root/'sources'/'heads.png');heads=Image.new('RGBA',(5*96,2*96));head_boxes=[]
for row in range(2):
 for col in range(5):
  c=im.crop((round(col*im.width/5),round(row*im.height/2),round((col+1)*im.width/5),round((row+1)*im.height/2)))
  c,b=clean(c);c=c.crop(b);height=80;width=round(c.width*height/c.height);c=c.resize((width,height),Image.Resampling.NEAREST);heads.alpha_composite(c,(col*96+(96-width)//2,row*96+96-height));head_boxes.append({'width':width,'height':height})
heads.save(root/'heads.png',optimize=True)
(root/'manifest.json').write_text(json.dumps({'version':1,'cell':192,'columns':8,'frames':frames,'heads':head_boxes},separators=(',',':')))
print('Packed',len(frames),'whole poses and 10 front/back head modules')
