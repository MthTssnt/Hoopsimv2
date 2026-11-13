"""Record reproducible rendered frames. Requires Playwright Python, Chromium and ffmpeg."""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--label', required=True)
parser.add_argument('--live', action='store_true', help='Record actual playback via canvas captureStream')
parser.add_argument('--seed', type=int, default=8126)
parser.add_argument('--seconds', type=int, default=30)
parser.add_argument('--output', type=Path, default=Path('/tmp/hoopsim-gameplay'))
parser.add_argument('--url', default='http://127.0.0.1:5173')
args = parser.parse_args()
if args.seconds < 1 or not args.label.replace('-', '').replace('_', '').isalnum():
    parser.error('Use a positive duration and an alphanumeric label.')
frames = args.output / (args.label + '-frames')
frames.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=shutil.which('chromium'), headless=True,
                                args=['--no-sandbox', '--disable-dev-shm-usage'])
    page = browser.new_page(viewport={'width': 1280, 'height': 720})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(f'{args.url}/?court&seed={args.seed}&watch&atelier', wait_until='networkidle')
    page.wait_for_selector('[aria-label="Inspecteur de match"]', timeout=120000)
    if not args.live:
        page.add_style_tag(content='[aria-label="Inspecteur de match"] {display:none!important}')
    if args.live:
        page.evaluate("""()=>{
          window.captureChunks=[];
          window.captureRecorder=new MediaRecorder(document.querySelector('canvas').captureStream(30), {mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:6000000});
          window.captureRecorder.ondataavailable=e=>window.captureChunks.push(e.data);
          window.captureRecorder.start(1000);
        }""")
        page.get_by_role('button', name='Lire le match', exact=True).click()
        page.add_style_tag(content='[aria-label="Inspecteur de match"] {display:none!important}')
        page.wait_for_timeout(args.seconds * 1000)
        page.evaluate('window.__hoopsim.play(false)')
        with page.expect_download() as downloaded:
            page.evaluate("""async()=>{
              await new Promise(r=>{window.captureRecorder.onstop=r;window.captureRecorder.stop()});
              const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(window.captureChunks,{type:'video/webm'}));
              a.download='capture.webm';a.click();
            }""")
        downloaded.value.save_as(args.output / (args.label + '.webm'))
    else:
        for index in range(args.seconds * 30):
            page.evaluate('window.__hoopsim.advance(4)')
            page.screenshot(path=str(frames / f'{index:04}.png'), animations='disabled')
    page.screenshot(path=str(args.output / (args.label + '.png')))
    snapshot = page.evaluate('window.__hoopsim.snapshot()')
    snapshot['errors'] = errors
    snapshot['capture'] = {'seed': args.seed, 'seconds': args.seconds, 'fps': 30,
                           'physicsStepsPerFrame': None if args.live else 4, 'mode': 'live' if args.live else 'stepped', 'audioTrack': False}
    (args.output / (args.label + '.json')).write_text(json.dumps(snapshot, indent=2) + '\n')
    browser.close()
assert not errors, errors
inputs = ['-i', str(args.output / (args.label + '.webm'))] if args.live else ['-framerate', '30', '-i', str(frames / '%04d.png')]
subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', *inputs,
                '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18',
                str(args.output / (args.label + '.mp4'))], check=True)
print(args.output / (args.label + '.mp4'))
