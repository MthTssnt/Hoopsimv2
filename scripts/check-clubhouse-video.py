"""Inspect real MP4 frame crops and preserve capture clock / pose evidence."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,subprocess
out=Path('docs/validation/clubhouse-fidelity');trace=json.loads((out/'trace-match.json').read_text());samples=trace['samples'];font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',20)
def frame(s):
 path=Path('/tmp/hoopsim-fidelity/video-frame.png');path.parent.mkdir(parents=True,exist_ok=True);subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',str(s['ms']/1000),'-i',str(out/'45-dribble-deplacement-arret.mp4'),'-frames:v','1',str(path)],check=True);im=Image.open(path);cam=s['camera'];feet=s['players'][0]['feet'];x=(feet['x']-cam['left'])*cam['screenZoom'];y=(feet['y']-cam['top'])*cam['screenZoom'];return im.crop((round(x-64),round(y-112),round(x+64),round(y+16)))
phases=Image.new('RGB',(1536,570),'#f3e7cf');draw=ImageDraw.Draw(phases)
marks=trace['marks'];times=[marks[0]['ms']/2,(marks[0]['ms']+marks[1]['ms'])/2,(marks[1]['ms']+marks[2]['ms'])/2]
for i,(label,ms) in enumerate(zip(['Sur place','Déplacement','Arrêt'],times)):
 s=min(samples,key=lambda s:abs(s['ms']-ms));phases.paste(frame(s).resize((512,512),Image.Resampling.NEAREST),(512*i,48));draw.text((512*i+20,8),label,font=font,fill='#173e2d')
phases.save(out/'video-etapes-loupe.png')
cycle=Image.new('RGB',(1536,310),'#f3e7cf');draw=ImageDraw.Draw(cycle);stationary=[s for s in samples if s['ms']<marks[0]['ms']]
for i,(label,phase) in enumerate([('Main haute',0),('Poussée',.125),('Descente',.3),('Rebond',.5),('Reprise',.75),('Contrôle',.9)]):
 s=min(stationary,key=lambda s:abs(s['dribblePhase']-phase));cycle.paste(frame(s).resize((256,256),Image.Resampling.NEAREST),(256*i,40));draw.text((256*i+8,8),label,font=font,fill='#173e2d')
cycle.save(out/'dribble-cycle-reel.png')
last=samples[-1];assert all(s['holder']==0 for s in samples);assert last['players'][0]['velocity']['x']==last['players'][0]['velocity']['y']==0;assert last['players'][0]['state']['name']=='dribbleIdle';assert not trace['errors']
clock=samples[-1]['clock']-samples[0]['clock'];wall=(samples[-1]['ms']-samples[0]['ms'])/1000
result={'durationMs':samples[-1]['ms'],'recordedFramesPerSecond':30,'runtimeFpsRange':[min(s['performance']['actualFps'] for s in samples),max(s['performance']['actualFps'] for s in samples)],'physicsSeconds':clock,'wallSeconds':wall,'physicsWallRatio':clock/wall,'phases':marks,'holderPreserved':True,'stoppedVelocity':last['players'][0]['velocity'],'lastPose':last['players'][0]['state'],'browserErrors':trace['errors'],'renderer':'Phaser Canvas fallback (Chromium cloud --disable-webgl); normal game camera, no speed correction','preparation':last['preparation']}
assert .94<clock/wall<1.06,result
(out/'verification-video.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,ensure_ascii=False))
