import { useEffect, useRef, useState } from 'react';
import { PLAYER_SOURCES } from '../assets/players/sources';
import { COURT_DESIGNS } from '../assets/players/courtDesigns';
import { ACTION_RECTS } from '../assets/players/actions';
import './playerDesigns.css';

const POSES = ['Face', 'Dos', 'Course A', 'Course B', 'Tir armé', 'Lâcher', 'Passe', 'Dunk / contre'];

/** Catalogue des dix designs officiels, sans les anciennes planches de recherche. */
export default function PlayerDesigns() {
  const [images, setImages] = useState<HTMLImageElement[]>([]);
  const [pose, setPose] = useState(0);
  const [error, setError] = useState(false);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all(PLAYER_SOURCES.map(async (url) => { const image = new Image(); image.src = url; await image.decode(); return image; }))
      .then((loaded) => { if (active) setImages(loaded); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setPose((p) => p === 2 ? 3 : 2), 300);
    return () => window.clearInterval(timer);
  }, [playing]);
  return <main className="player-style">
    <header><span className="player-kicker">HOOPSIM · DESIGNS OFFICIELS</span><h1>Les joueurs</h1>
      <p>Deux tenues, dix designs, des tailles et corpulences adaptées à chaque joueur.</p>
      <a className="btn btn-primary" href="?court">Tester un match jouable →</a>
    </header>
    <section className="player-toolbar" aria-label="Pose du joueur">
      {POSES.map((label, i) => <button key={label} aria-pressed={pose === i} onClick={() => { setPlaying(false); setPose(i); }}>{label}</button>)}
      <button onClick={() => { setPose(2); setPlaying((p) => !p); }}>{playing ? 'Pause' : 'Animer la course'}</button>
    </section>
    {error ? <p role="alert">Impossible de charger les planches des joueurs.</p> : images.length !== 4 ? <p role="status">Chargement des joueurs…</p> : COURT_DESIGNS.map((designs, team) => <section key={team}>
      <h2>{team === 0 ? 'Tenue bleu et blanc' : 'Tenue ivoire et bordeaux'}</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>{designs.map((design, variant) => <figure key={design.name} style={{ width: 176 }}>
        <Design images={images} team={team} variant={variant} pose={pose} /><figcaption>{design.name}</figcaption>
      </figure>)}</div>
    </section>)}
  </main>;
}

function Design({ images, team, variant, pose }: { images: HTMLImageElement[]; team: number; variant: number; pose: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 176, 208);
    ctx.imageSmoothingEnabled = false;
    const design = COURT_DESIGNS[team][variant];
    const rect = pose < 4 ? design.frames[pose] : ACTION_RECTS[team][variant][pose - 4];
    const k = 145 / design.frames[0].height;
    const w = Math.round(rect.width * k);
    const h = Math.round(rect.height * k);
    ctx.drawImage(images[team + (pose < 4 ? 0 : 2)], rect.x, rect.y, rect.width, rect.height, Math.round((176 - w) / 2), 204 - h, w, h);
  }, [images, team, variant, pose]);
  return <canvas ref={ref} width={176} height={208} role="img" aria-label={`${COURT_DESIGNS[team][variant].name}, ${POSES[pose]}`} />;
}
