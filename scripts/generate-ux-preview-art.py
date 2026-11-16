"""Original pixel illustration for management previews; never uses player or court game assets."""
from PIL import Image,ImageDraw
from pathlib import Path
root=Path('src/assets/ux-preview');root.mkdir(exist_ok=True)
for theme,bg,seat,wood,light in [('arcade','#173b73','#3879ce','#dc9b56','#fff5ca'),('almanac','#e2d2af','#8b9da6','#c78a52','#fff9ec')]:
 im=Image.new('RGB',(192,112),bg);d=ImageDraw.Draw(im)
 # stepped stands, roof and banks of stadium lights
 d.rectangle((4,4,187,7),fill=light)
 for x in [14,48,82,116,150]:
  d.rectangle((x,8,x+20,14),fill='#152840');d.rectangle((x+3,9,x+7,11),fill=light);d.rectangle((x+12,9,x+16,11),fill=light)
 for row in range(4):
  y=25+row*9
  d.rectangle((4,y,187,y+2),fill=seat)
  for x in range(8+(row%2)*4,185,13):d.rectangle((x,y-4,x+3,y-1),fill=light)
 # Perspective court with crisp stepped hardwood, correct rim/backboard symbol.
 d.polygon([(35,66),(151,66),(187,103),(5,103)],fill=wood)
 d.line([(35,66),(151,66),(187,103),(5,103),(35,66)],fill=light,width=1)
 for x in range(40,150,18):d.line((x,67,x+(x-96)//2,102),fill='#b47842')
 d.line([(75,68),(117,68),(127,88),(65,88),(75,68)],fill=light)
 d.arc((52,60,140,103),0,180,fill=light,width=1)
 d.rectangle((93,39,96,65),fill='#152840');d.rectangle((80,37,109,53),fill=light);d.rectangle((83,40,106,50),fill=bg);d.rectangle((89,44,100,50),outline=light);d.rectangle((90,52,101,54),fill='#a52f25');d.line([(91,55),(93,61),(98,61),(100,55)],fill=light)
 # Original tiny athlete shooting silhouette, separate from protected game sprites.
 d.rectangle((48,66,53,71),fill='#152840');d.rectangle((46,72,55,83),fill=light);d.rectangle((47,83,50,91),fill='#152840');d.rectangle((53,83,56,89),fill='#152840');d.rectangle((45,89,51,92),fill='#152840');d.rectangle((53,88,60,91),fill='#152840');d.line([(47,74),(43,69),(43,61),(47,59)],fill=light,width=2);d.line([(54,73),(58,67),(57,60),(52,58)],fill=light,width=2)
 d.rectangle((47,52,54,58),fill='#f47928');d.line((50,52,50,58),fill='#152840');d.line((47,55,54,55),fill='#152840')
 # Small sports pennant in the corner.
 d.rectangle((165,70,167,94),fill=light);d.polygon([(168,70),(184,74),(168,80)],fill='#a52f25')
 parts=[]
 for y in range(112):
  x=0
  while x<192:
   start=x;c=im.getpixel((x,y))
   while x<192 and im.getpixel((x,y))==c:x+=1
   parts.append(f'<rect x="{start}" y="{y}" width="{x-start}" height="1" fill="#{c[0]:02x}{c[1]:02x}{c[2]:02x}"/>')
 (root/f'{theme}-courtside.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 112" shape-rendering="crispEdges">'+''.join(parts)+'</svg>')
