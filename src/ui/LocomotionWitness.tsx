import { useEffect, useRef, useState } from 'react';
import front from '../assets/players/locomotion/0-0-down.png';
import back from '../assets/players/locomotion/0-0-up.png';
import frames from '../assets/players/locomotion/frames.json';
import reference from '../assets/players/team-navy.png';
import { COURT_DESIGNS, playerScale, type SpriteRect } from '../assets/players/courtDesigns';

// Candidate timing is for inspection only; the match's physics and selector are unchanged.
const MOTIONS = [
  { label: 'Démarrage', ms: 420, loop: false },
  { label: 'Freinage', ms: 420, loop: false },
  { label: 'Pivot', ms: 600, loop: false },
  { label: 'Posture défensive', ms: 800, loop: true },
  { label: 'Pas chassés', ms: 600, loop: true },
  { label: 'Recul', ms: 600, loop: true },
];

export default function LocomotionWitness() {
  const [motion, setMotion] = useState(0);
  const [orientation, setOrientation] = useState('down:right');
  const [height, setHeight] = useState(200);
  const [heavy, setHeavy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [images, setImages] = useState<HTMLImageElement[]>([]);
  const [failed, setFailed] = useState(false);
  const def = MOTIONS[motion];
  const frame = Math.min(3, Math.floor((def.loop ? time % def.ms : time) / def.ms * 4));
  const [heading, facing] = orientation.split(':') as ['down' | 'up', 'left' | 'right'];

  useEffect(() => {
    let live = true;
    Promise.all([front, back, reference].map(async (url) => {
      const image = new Image(); image.src = url; await image.decode(); return image;
    })).then((value) => { if (live) setImages(value); }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (!playing) return;
    let request = 0, previous = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(now - previous, 80); previous = now;
      setTime((value) => Math.min(def.loop ? Infinity : def.ms, value + dt * speed));
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [playing, speed, def]);
  useEffect(() => {
    if (playing && !def.loop && time >= def.ms) setPlaying(false);
  }, [playing, time, def]);

  return <div className="lab-witness">
    <h2>Locomotion sans ballon · planches témoins</h2>
    <p>Afro, bandeau jaune · 48 nouveaux dessins entiers, face et dos. Candidats non activés en match.
      Le pivot et les appuis restent à vérifier sur une trajectoire réelle avant déclinaison aux dix designs.</p>
    <div className="lab-toolbar">
      <label>Geste<select aria-label="Geste témoin" value={motion} onChange={(e) => { setMotion(Number(e.target.value)); setTime(0); setPlaying(false); }}>{MOTIONS.map((m, i) => <option key={m.label} value={i}>{m.label}</option>)}</select></label>
      <label>Orientation<select aria-label="Orientation témoin" value={orientation} onChange={(e) => setOrientation(e.target.value)}><option value="down:right">Face · droite</option><option value="down:left">Face · gauche</option><option value="up:right">Dos · droite</option><option value="up:left">Dos · gauche</option></select></label>
      <label>Taille<select aria-label="Taille témoin" value={height} onChange={(e) => setHeight(Number(e.target.value))}>{[180, 200, 220].map((h) => <option key={h} value={h}>{h} cm</option>)}</select></label>
      <label className="lab-check"><input type="checkbox" checked={heavy} onChange={(e) => setHeavy(e.target.checked)} /> Corpulence forte</label>
      <label>Zoom<select aria-label="Zoom témoin" value={zoom} onChange={(e) => setZoom(Number(e.target.value))}><option value={1}>Taille match</option><option value={3}>×3 · inspection</option></select></label>
    </div>
    {failed ? <p role="alert">Le chargement des planches témoins a échoué.</p> : images.length !== 3 ? <p role="status">Chargement des dessins…</p> : <>
      <div className="lab-witness-comparison">
        <figure><figcaption>{def.label} · image {frame + 1}/4</figcaption><WitnessCanvas image={images[heading === 'down' ? 0 : 1]} rect={frames[heading][motion * 4 + frame]} height={height} heavy={heavy} left={facing === 'left'} zoom={zoom} /></figure>
        <figure><figcaption>Identité validée · même gabarit</figcaption><WitnessCanvas image={images[2]} rect={COURT_DESIGNS[0][0].frames[heading === 'up' ? 1 : 0]} height={height} heavy={heavy} left={facing === 'left'} zoom={zoom} /></figure>
      </div>
      <div className="lab-playback">
        <button onClick={() => { if (time >= def.ms && !def.loop) setTime(0); setPlaying((p) => !p); }}>{playing ? 'Pause témoin' : 'Lire témoin'}</button>
        <button aria-label="Recommencer le geste témoin" onClick={() => { setTime(0); setPlaying(false); }}>Recommencer</button>
        <button aria-label="Image témoin suivante" onClick={() => { setPlaying(false); setTime(((frame + 1) % 4) * def.ms / 4); }}>Image suivante →</button>
        <label>Vitesse<select aria-label="Vitesse témoin" value={speed} onChange={(e) => setSpeed(Number(e.target.value))}><option value={0.25}>×0,25</option><option value={1}>×1</option></select></label>
      </div>
      <p>Cadence d’étude : {def.ms} ms, {def.loop ? 'cycle' : 'geste arrêté sur la dernière image'}. Alignement provisoire par le bas de la silhouette ; ce n’est pas une preuve d’appui physique.</p>
      <details><summary>Planches sources candidates · 6 rangées × 4 images</summary><p>Ordre : démarrage, freinage, pivot, défense, pas chassés, recul.</p><div className="lab-witness-sheets"><img src={front} alt="24 poses candidates de face" /><img src={back} alt="24 poses candidates de dos" /></div></details>
    </>}
  </div>;
}

function WitnessCanvas({ image, rect, height, heavy, left, zoom }: { image: HTMLImageElement; rect: SpriteRect; height: number; heavy: boolean; left: boolean; zoom: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d'); if (!ctx) return;
    ctx.resetTransform(); ctx.clearRect(0, 0, 192, 192); ctx.imageSmoothingEnabled = false;
    // A fixed source scale preserves crouches; never stretch every frame to the standing height.
    const scale = playerScale(height, heavy, COURT_DESIGNS[0][0]).height * 2 / 233;
    const w = Math.round(rect.width * scale * (heavy ? 1.1 : 1)), h = Math.round(rect.height * scale);
    if (left) { ctx.translate(192, 0); ctx.scale(-1, 1); }
    ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height, Math.round(96 - w / 2), 168 - h, w, h);
    ctx.resetTransform(); ctx.fillStyle = '#e8bc7680'; ctx.fillRect(0, 168, 192, 1);
  }, [image, rect, height, heavy, left]);
  return <canvas ref={ref} width={192} height={192} style={{ width: 192 * zoom, height: 192 * zoom }} role="img" aria-label={`Pose témoin ${height} cm, ${left ? 'gauche' : 'droite'}`} />;
}
