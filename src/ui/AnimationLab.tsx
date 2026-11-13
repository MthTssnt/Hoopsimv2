import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { PLAYER_SOURCES } from '../assets/players/sources';
import { COURT_DESIGNS } from '../assets/players/courtDesigns';
import { BALL_ART, MAPLE_ART } from '../match/render/arena/style';
import { appearanceFor, type Appearance } from '../match/render/sprites/appearance';
import { paintMotion } from '../match/render/sprites/motionArt';
import { MOTIONS, dribbleBallAt, type MotionId } from '../match/render/sprites/motion';
import { FRAME, SPRITE_DETAIL, type Facing, type Heading } from '../match/render/sprites/views';
import './animationLab.css';
import { previewPose } from '../match/render/previewPose';

const LocomotionWitness = lazy(() => import('./LocomotionWitness'));

let loaded: Promise<HTMLImageElement[]> | undefined;
function loadImages() {
  return loaded ??= Promise.all([...PLAYER_SOURCES, BALL_ART, MAPLE_ART].map(async (url) => { const i = new Image(); i.src = url; await i.decode(); return i; }));
}
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

export default function AnimationLab({ embedded = false }: { embedded?: boolean }) {
  const [images, setImages] = useState<HTMLImageElement[]>([]);
  const [failed, setFailed] = useState(false);
  const [section, setSection] = useState<'designs' | 'animations' | 'court' | 'witness'>(() => !embedded && new URLSearchParams(location.search).has('poses') ? 'witness' : !embedded && new URLSearchParams(location.search).has('style') ? 'designs' : 'animations');
  const [motion, setMotion] = useState<MotionId>('dribble');
  const [matchPhases, setMatchPhases] = useState(true);
  const [team, setTeam] = useState(0), [variant, setVariant] = useState(0);
  const [direction, setDirection] = useState('down:right');
  const [playing, setPlaying] = useState(true), [speed, setSpeed] = useState(0.5);
  const [time, setTime] = useState(0), [marks, setMarks] = useState(false);
  const [height, setHeight] = useState(200), [heavy, setHeavy] = useState(false);
  useEffect(() => { let live = true; loadImages().then((i) => { if (live) setImages(i); }).catch(() => { if (live) setFailed(true); }); return () => { live = false; }; }, []);
  useEffect(() => {
    if (!playing) return;
    let request = 0, previous = performance.now();
    const tick = (now: number) => { const dt = Math.min(80, now - previous); previous = now; setTime((t) => t + dt * speed); request = requestAnimationFrame(tick); };
    request = requestAnimationFrame(tick); return () => cancelAnimationFrame(request);
  }, [playing, speed]);
  const sourceDef = MOTIONS.find((m) => m.id === motion)!;
  const def = { ...sourceDef, ms: matchPhases && ['jumpShot', 'layup', 'dunk'].includes(motion) ? 1200 : sourceDef.ms };
  const index = Math.floor((time % def.ms) / def.ms * def.count);
  const [heading, facing] = direction.split(':') as [Heading, Facing];
  const look = useMemo(() => ({ ...appearanceFor({ id: `atelier-${team}-${variant}`, heightCm: height, weightKg: heavy ? 130 : 90, number: 23 }, variant), heavy }), [team, variant, height, heavy]);
  const selectFrame = (i: number) => { setPlaying(false); setTime(i * def.ms / def.count); };
  return <section className={`animation-lab${embedded ? ' is-embedded' : ''}`}>
    <header className="lab-heading"><div><span className="lab-eyebrow">HOOPSIM · ATELIER VISUEL</span><h1>Animations & terrain</h1><p>{section === 'witness' ? 'Nouveaux dessins candidats, comparés aux références validées.' : 'Les mêmes images et les mêmes points de contact que dans le match.'}</p></div><a className="lab-link" href="?court&seed=8126">Tester sur le terrain →</a></header>
    <nav className="lab-tabs" aria-label="Atelier visuel">
      <button aria-pressed={section === 'animations'} onClick={() => setSection('animations')}>Animations</button>
      <button aria-pressed={section === 'designs'} onClick={() => setSection('designs')}>Joueurs</button>
      <button aria-pressed={section === 'court'} onClick={() => setSection('court')}>Terrain & ballon</button>
      <button aria-pressed={section === 'witness'} onClick={() => setSection('witness')}>Poses témoins</button>
    </nav>
    {failed ? <p role="alert">Le chargement des dessins a échoué. Recharge la page pour réessayer.</p> : images.length !== PLAYER_SOURCES.length + 2 ? <p role="status">Chargement de l’atelier…</p> : <>
      {section === 'witness' && <Suspense fallback={<p role="status">Chargement des poses témoins…</p>}><LocomotionWitness /></Suspense>}
      {section === 'animations' && <>
        <div className="lab-layout">
          <aside className="lab-motion-list" aria-label="Liste des animations">{MOTIONS.map((m) => <button key={m.id} aria-pressed={motion === m.id} onClick={() => { setMotion(m.id); setTime(0); }}><span>{m.label}</span><small>{m.count} images</small></button>)}</aside>
          <div className="lab-workbench">
            <div className="lab-toolbar">
              <label>Vue<select aria-label="Vue des animations" value={matchPhases ? 'match' : 'source'} onChange={(e) => { setMatchPhases(e.target.value === 'match'); setTime(0); }}><option value="match">Phases du match</option><option value="source">Planches sources</option></select></label>
              <label>Tenue<select aria-label="Tenue" value={team} onChange={(e) => setTeam(Number(e.target.value))}><option value={0}>Bleu & blanc</option><option value={1}>Ivoire & bordeaux</option></select></label>
              <label>Joueur<select aria-label="Joueur" value={variant} onChange={(e) => setVariant(Number(e.target.value))}>{COURT_DESIGNS[team].map((d, i) => <option key={d.name} value={i}>{d.name}</option>)}</select></label>
              <label>Orientation<select aria-label="Orientation" value={direction} onChange={(e) => setDirection(e.target.value)}><option value="down:right">Face · droite</option><option value="down:left">Face · gauche</option><option value="up:right">Dos · droite</option><option value="up:left">Dos · gauche</option></select></label>
            </div>
            <div className="lab-stage">
              <MotionCanvas images={images} look={look} team={team} motion={motion} frame={index} heading={heading} facing={facing} zoom={4} marks={marks} phase={(time % def.ms) / def.ms} matchPhases={matchPhases} />
              <div className="lab-stage-info"><span className="lab-eyebrow">{def.loop ? 'CYCLE' : 'GESTE'}</span><h2>{def.label}</h2><p>{def.count} images · {(def.ms / 1000).toFixed(2).replace('.', ',')} s</p><p className="lab-frame-counter" aria-live="off">{String(index + 1).padStart(2, '0')}<span> / {String(def.count).padStart(2, '0')}</span></p><label className="lab-check"><input type="checkbox" checked={marks} onChange={(e) => setMarks(e.target.checked)} /> Points de contact & cadre</label><p className="lab-explanation">Lecture à vitesse réelle ou ralentie, puis image par image.</p><figure className="lab-reference"><figcaption>Référence validée</figcaption><ReferenceCanvas images={images} look={look} team={team} /></figure></div>
            </div>
            <div className="lab-playback"><button onClick={() => setPlaying((p) => !p)}>{playing ? 'Pause' : 'Lire'}</button><button onClick={() => selectFrame((index + def.count - 1) % def.count)} aria-label="Image précédente">←</button><button onClick={() => selectFrame((index + 1) % def.count)} aria-label="Image suivante">→</button><label>Vitesse<select aria-label="Vitesse" value={speed} onChange={(e) => setSpeed(Number(e.target.value))}><option value={0.25}>×0,25</option><option value={0.5}>×0,5</option><option value={1}>×1</option><option value={2}>×2</option></select></label><input aria-label="Image de l’animation" type="range" min={1} max={def.count} value={index + 1} onChange={(e) => selectFrame(Number(e.target.value) - 1)} /></div>
            <div className="lab-frames" aria-label="Images de l’animation">{Array.from({ length: def.count }, (_, f) => <button aria-label={`Image ${f + 1}`} aria-pressed={index === f} key={f} onClick={() => selectFrame(f)}><MotionCanvas images={images} look={look} team={team} motion={motion} frame={f} heading={heading} facing={facing} zoom={1.5} marks={marks} /><span>{String(f + 1).padStart(2, '0')}</span></button>)}</div>
            <div className="lab-toolbar lab-build"><label>Taille : {height} cm<input aria-label="Taille du joueur" type="range" min={180} max={220} value={height} onChange={(e) => setHeight(Number(e.target.value))} /></label><label className="lab-check"><input type="checkbox" checked={heavy} onChange={(e) => setHeavy(e.target.checked)} /> Corpulence forte</label></div>
          </div>
        </div>
      </>}
      {section === 'designs' && COURT_DESIGNS.map((designs, t) => <section key={t}><h2>{t === 0 ? 'Bleu & blanc' : 'Ivoire & bordeaux'}</h2><div className="lab-designs">{designs.map((design, v) => <figure key={design.name}><MotionCanvas images={images} look={{ ...look, variant: v }} team={t} motion="idle" frame={0} heading="down" facing="right" zoom={3} marks={false} /><figcaption>{design.name}</figcaption></figure>)}</div></section>)}
      {section === 'court' && <div className="lab-decor"><div><h2>Érable chaud & lignes ivoire</h2><div className="lab-wood" style={{ backgroundImage: `url(${MAPLE_ART})` }}><span>Parquet fin · bleu nuit · détails dorés</span></div><a href="?court&seed=8126" className="lab-link">Voir le terrain en jeu →</a></div><div><h2>Ballon orange chaud</h2><BallCanvas source={images[PLAYER_SOURCES.length]} spin={Math.floor(time / 90) % 6} /><p>Coutures sombres, reflet et rotation en 6 vues.</p></div></div>}
    </>}
  </section>;
}

export function paintBall(ctx: CanvasRenderingContext2D, source: HTMLImageElement, x: number, y: number, spin: number): void {
  const cx = source.width * [0.1875, 0.5, 0.8125][spin % 3], cy = source.height * (spin < 3 ? 0.275 : 0.75), r = source.width * 0.1;
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(source, cx - r, cy - r, r * 2, r * 2, Math.round(x - 5), Math.round(y - 5), 10, 10); ctx.restore();
}
function MotionCanvas({ images, look, team, motion: requestedMotion, frame: requestedFrame, heading, facing, zoom, marks, phase, matchPhases = false }: { images: HTMLImageElement[]; look: Appearance; team: number; motion: MotionId; frame: number; heading: Heading; facing: Facing; zoom: number; marks: boolean; phase?: number; matchPhases?: boolean }) {
  const selected = matchPhases ? previewPose(requestedMotion, phase ?? 0, heading, facing === 'left' ? -1 : 1) : null;
  const motion = selected?.motion ?? requestedMotion, frame = selected?.frame ?? requestedFrame;
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d'); if (!ctx) return;
    ctx.imageSmoothingEnabled = false; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, FRAME.width * SPRITE_DETAIL, FRAME.height * SPRITE_DETAIL);
    const art = paintMotion(images, look, team, motion, frame, heading, facing); ctx.drawImage(art.canvas, 0, 0); ctx.scale(SPRITE_DETAIL, SPRITE_DETAIL);
    let ball = art.pose.ball;
    if (motion === 'dribble' || motion === 'dribbleIdle') {
      const anchors = Array.from({ length: 8 }, (_, f) => paintMotion(images, look, team, motion, f, heading, facing).pose.ball);
      ball = dribbleBallAt(phase ?? frame / 8, anchors, FRAME.groundY - 5);
    }
    if (!ball && frame === 3 && ['jumpShot', 'layup', 'freeThrow', 'pass', 'lobPass'].includes(motion)) {
      const release = paintMotion(images, look, team, motion, 2, heading, facing).pose.ball
        ?? paintMotion(images, look, team, motion, 1, heading, facing).pose.ball;
      if (release) ball = { x: clamp(release.x + (facing === 'left' ? -9 : 9), 5, FRAME.width - 5), y: clamp(release.y - 10, 5, FRAME.height - 5) };
    }
    if (ball) {
      if (heading === 'up') { ctx.clearRect(0, 0, FRAME.width, FRAME.height); paintBall(ctx, images[PLAYER_SOURCES.length], ball.x, ball.y, frame % 6); ctx.drawImage(art.canvas, 0, 0, FRAME.width, FRAME.height); }
      else paintBall(ctx, images[PLAYER_SOURCES.length], ball.x, ball.y, frame % 6);
      ctx.drawImage(art.hand, 0, 0, FRAME.width, FRAME.height);
    }
    if (marks) {
      const b = Object.fromEntries(Object.entries(art.bounds).map(([key, value]) => [key, value / SPRITE_DETAIL])) as typeof art.bounds; ctx.strokeStyle = '#7ed8bf'; ctx.lineWidth = 0.5; ctx.strokeRect(b.left - 1, b.top - 1, b.right - b.left + 2, b.bottom - b.top + 2);
      ctx.fillStyle = '#e8bc76'; ctx.fillRect(0, FRAME.groundY, FRAME.width, 0.5);
      if (art.pose.palm) { ctx.fillStyle = '#5ce6e6'; ctx.fillRect(Math.round(art.pose.palm.x) - 1, Math.round(art.pose.palm.y) - 1, 2, 2); }
    }
  }, [images, look, team, motion, frame, heading, facing, marks, phase]);
  return <canvas ref={ref} width={FRAME.width * SPRITE_DETAIL} height={FRAME.height * SPRITE_DETAIL} style={{ width: FRAME.width * zoom, height: FRAME.height * zoom }} role="img" aria-label={`${motion}, image ${frame + 1}, ${heading}, ${facing}`} />;
}
function BallCanvas({ source, spin }: { source: HTMLImageElement; spin: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const ctx = ref.current?.getContext('2d'); if (!ctx) return; ctx.imageSmoothingEnabled = false; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, 16 * SPRITE_DETAIL, 16 * SPRITE_DETAIL); ctx.scale(SPRITE_DETAIL, SPRITE_DETAIL); paintBall(ctx, source, 8, 8, spin); }, [source, spin]);
  return <canvas ref={ref} width={16 * SPRITE_DETAIL} height={16 * SPRITE_DETAIL} style={{ width: 192, height: 192, imageRendering: 'pixelated' }} role="img" aria-label="Nouveau ballon en rotation" />;
}

function ReferenceCanvas({ images, look, team }: { images: HTMLImageElement[]; look: Appearance; team: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d'); if (!ctx) return;
    ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, 96, 120);
    const r = COURT_DESIGNS[team][look.variant].frames[0], h = 90, w = r.width / r.height * h * (look.heavy ? 1.1 : 1);
    ctx.drawImage(images[team], r.x, r.y, r.width, r.height, Math.round(48 - w / 2), 112 - h, Math.round(w), h);
  }, [images, look, team]);
  return <canvas ref={ref} width={96} height={120} style={{ width: 144, height: 180 }} role="img" aria-label="Personnage de la planche validée" />;
}
