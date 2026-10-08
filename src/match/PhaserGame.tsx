import { useCallback, useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import type { PlayedGame } from '../engine/simSeason';
import type { BoxView } from './boxView';
import { VIEW_HEIGHT, VIEW_WIDTH } from './config';
import type { MatchSetup } from './gameResult';
import { HudScene } from './scenes/HudScene';
import { MatchScene, WATCH_SPEEDS } from './scenes/MatchScene';
import { attachIntegerScaling, integerZoom } from './screen';
import { loadSettings, saveSettings, type MatchSettings } from './settings';
import { MatchPause } from './ui/MatchPause';
import { MatchSettingsPanel } from './ui/MatchSettings';

/** Touches du menu pause (si elles ne servent pas déjà à une action du joueur). */
const isPauseKey = (event: KeyboardEvent) => event.key === 'Escape' || event.key === 'p' || event.key === 'P';

/**
 * Monte une instance Phaser dans React et la détruit proprement au démontage. Le match est en
 * 640×360, mis à l'échelle entière (pixels nets) ; F bascule en plein écran, panneau compris.
 * Les réglages vivent ici (sauvegardés) et passent au jeu par `game.registry`. Échap ou P (ou le
 * bouton) met le match en pause : le match s'arrête et publie son box score, affiché par le menu.
 *
 * Sans `match` : la page de test `?court`. Avec `match` (le GM) : ton vrai match, à jouer ou à
 * regarder (vitesses ×1, ×2, ×4 avec les touches 1-3 ou les boutons) ; « Simuler la fin » le
 * termine tout seul ; à la fin, le résultat part au GM par `onMatchOver`.
 */
export default function PhaserGame({ match, onMatchOver }: { match?: MatchSetup; onMatchOver?: (played: PlayedGame) => void } = {}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [settings, setSettings] = useState<MatchSettings>(loadSettings);
  const [panelOpen, setPanelOpen] = useState(false);
  /** Menu pause ouvert, avec le box score publié par le match (null hors 5 contre 5). */
  const [pause, setPause] = useState<{ box: BoxView | null } | null>(null);
  const pausedRef = useRef(false);
  const initialSettings = useRef(settings);
  // Lus par l'écouteur de la touche F, installé une seule fois.
  const settingsRef = useRef(settings);
  const panelOpenRef = useRef(panelOpen);
  /** Regarder : vitesse choisie ; fin simulée en cours (plus de boutons). */
  const [speed, setSpeed] = useState(1);
  const [finishing, setFinishing] = useState(false);
  const initialMatch = useRef(match ?? null);
  const onMatchOverRef = useRef(onMatchOver);
  onMatchOverRef.current = onMatchOver;

  useEffect(() => {
    if (!parentRef.current || !rootRef.current) return;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: parentRef.current,
      width: VIEW_WIDTH,
      height: VIEW_HEIGHT,
      pixelArt: true,
      backgroundColor: '#000000',
      scale: {
        mode: Phaser.Scale.NONE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        zoom: integerZoom(window.innerWidth, window.innerHeight, VIEW_WIDTH, VIEW_HEIGHT),
        // Le conteneur englobe aussi le panneau des réglages, utilisable en plein écran.
        fullscreenTarget: rootRef.current,
      },
      scene: [MatchScene, HudScene],
    });
    game.registry.set('settings', initialSettings.current);
    game.registry.set('matchSetup', initialMatch.current);
    game.events.on('match-over', (played: PlayedGame) => onMatchOverRef.current?.(played));
    // Le jeu peut demander un changement de réglage (ex. touche C pour la caméra).
    game.events.on('request-settings', (next: MatchSettings) => setSettings(next));
    // Le match s'est arrêté : il publie son box score.
    game.events.on('pause-box', (box: BoxView | null) => setPause({ box }));
    const onPauseKey = (event: KeyboardEvent) => {
      if (event.repeat || panelOpenRef.current) return;
      if (Object.values(settingsRef.current.bindings).some((b) => b.code === event.keyCode)) return;
      // Regarder : 1, 2, 3 pour ×1, ×2, ×4.
      const k = ['1', '2', '3'].indexOf(event.key);
      if (k >= 0 && initialMatch.current?.mode === 'regarder' && !pausedRef.current) {
        changeSpeed(game, WATCH_SPEEDS[k]);
        return;
      }
      if (!isPauseKey(event)) return;
      event.preventDefault();
      togglePause(game);
    };
    window.addEventListener('keydown', onPauseKey);
    // F : plein écran, sauf panneau ouvert ou touche déjà liée à une action du joueur.
    const detach = attachIntegerScaling(
      game,
      { width: VIEW_WIDTH, height: VIEW_HEIGHT },
      (event) => !panelOpenRef.current && !Object.values(settingsRef.current.bindings).some((b) => b.code === event.keyCode),
    );
    gameRef.current = game;
    return () => {
      window.removeEventListener('keydown', onPauseKey);
      detach();
      gameRef.current = null;
      game.destroy(true);
    };
  }, []);

  useEffect(() => {
    settingsRef.current = settings;
    saveSettings(settings);
    gameRef.current?.registry.set('settings', settings);
  }, [settings]);

  useEffect(() => {
    panelOpenRef.current = panelOpen;
    gameRef.current?.registry.set('inputBlocked', panelOpen);
  }, [panelOpen]);

  const onChange = useCallback((next: MatchSettings) => setSettings(next), []);

  /** Pause ou reprise : le match s'arrête (et publie son box score) ou repart. */
  function togglePause(game: Phaser.Game | null) {
    if (!game) return;
    const paused = !pausedRef.current;
    pausedRef.current = paused;
    if (!paused) setPause(null);
    game.events.emit('pause-request', paused);
  }
  const onResume = () => {
    if (pausedRef.current) togglePause(gameRef.current);
  };
  function changeSpeed(game: Phaser.Game | null, value: number) {
    setSpeed(value);
    game?.events.emit('watch-speed', value);
  }
  /** « Simuler la fin » : le menu se ferme, le match finit tout seul en accéléré. */
  const onFinish = () => {
    pausedRef.current = false;
    setPause(null);
    setFinishing(true);
    gameRef.current?.events.emit('finish-request');
  };

  return (
    <div ref={rootRef} style={{ position: 'relative', width: '100vw', height: '100vh', background: '#000' }}>
      <div ref={parentRef} style={{ width: '100%', height: '100%' }} />
      {pause && <MatchPause box={pause.box} onResume={onResume} onFinish={match && !finishing ? onFinish : undefined} />}
      {!pause && !finishing && (
        <button className="btn btn-sm" style={{ position: 'absolute', top: 48, right: 12 }} onClick={() => togglePause(gameRef.current)}>
          ⏸ Pause
        </button>
      )}
      {match?.mode === 'regarder' && !pause && !finishing && (
        <div className="row" style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', gap: 6 }}>
          {WATCH_SPEEDS.map((value) => (
            <button key={value} className={`btn btn-sm${speed === value ? ' btn-primary' : ''}`} onClick={() => changeSpeed(gameRef.current, value)}>
              ×{value}
            </button>
          ))}
          <button className="btn btn-sm" onClick={onFinish}>
            Simuler la fin
          </button>
        </div>
      )}
      <MatchSettingsPanel settings={settings} onChange={onChange} open={panelOpen} onOpenChange={setPanelOpen} />
    </div>
  );
}
