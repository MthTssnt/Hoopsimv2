"""Clean the two pilot SVG silhouettes, retaining their illustrated interior and team palettes."""
from pathlib import Path
from PIL import Image,ImageFilter
from collections import deque
import xml.etree.ElementTree as ET
for size,folder in [(64,Path('src/assets/branding/teams')),(32,Path('src/assets/branding/teams/small'))]:
 for team in ['bos','nyk']:
  file=folder/(team+'.svg');root=ET.fromstring(file.read_text())
  if root.get('data-contour')=='clubhouse-clean-v1':continue
  pixels={}
  for rect in root.findall('{*}rect'):
   for x in range(int(rect.get('x')),int(rect.get('x'))+int(rect.get('width'))):pixels[x,int(rect.get('y'))]=rect.get('fill')
  mask=Image.new('L',(size,size));mp=mask.load()
  for x,y in pixels:mp[x,y]=255
  # A one-pixel opening removes fragile spurs; closing repairs exterior pinholes.
  mask=mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
  inside=mask.filter(ImageFilter.MinFilter(3));clean={}
  for y in range(size):
   for x in range(size):
    if not mask.getpixel((x,y)):continue
    if not inside.getpixel((x,y)):clean[x,y]='#fff2d3';continue
    clean[x,y]=pixels.get((x,y)) or min(pixels.items(),key=lambda item:(item[0][0]-x)**2+(item[0][1]-y)**2)[1]
  parts=[]
  for y in range(size):
   x=0
   while x<size:
    c=clean.get((x,y));start=x;x+=1
    while x<size and clean.get((x,y))==c:x+=1
    if c:parts.append(f'<rect x="{start}" y="{y}" width="{x-start}" height="1" fill="{c}"/>')
  metadata=root.find('{*}metadata').text
  file.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" shape-rendering="crispEdges" data-contour="clubhouse-clean-v1"><metadata>{metadata}</metadata>'+''.join(parts)+'</svg>')
print('Boston / New York: continuous ivory contour, no isolated exterior pixels, 64 / 32 px.')
