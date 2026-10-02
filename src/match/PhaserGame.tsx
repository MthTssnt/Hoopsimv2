import { useCallback, useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { VIEW_HEIGHT, VIEW_WIDTH } from './config';
import { HudScene } from './scenes/HudScene';
import { MatchScene } from './scenes/MatchScene';
import { attachIntegerScaling, integerZoom } from './screen';
import { loadSettings, saveSettings, type MatchSettings } from './settings';
import { MatchSettingsPanel } from './ui/MatchSettings';

/**
 * Monte une instance Phaser dans React et la détruit proprement au démontage. Le match est en
 * 480×270, mis à l'échelle entière (pixels nets) ; F bascule en plein écran, panneau compris.
 * Les réglages vivent ici (sauvegardés) et passent au jeu par `game.registry`.
 */
export default function PhaserGame() {
  const rootRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [settings, setSettings] = useState<MatchSettings>(loadSettings);
  const [panelOpen, setPanelOpen] = useState(false);
  const initialSettings = useRef(settings);
  // Lus par l'écouteur de la touche F, installé une seule fois.
  const settingsRef = useRef(settings);
  const panelOpenRef = useRef(panelOpen);

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
    // Le jeu peut demander un changement de réglage (ex. touche C pour la caméra).
    game.events.on('request-settings', (next: MatchSettings) => setSettings(next));
    // F : plein écran, sauf panneau ouvert ou touche déjà liée à une action du joueur.
    const detach = attachIntegerScaling(
      game,
      { width: VIEW_WIDTH, height: VIEW_HEIGHT },
      (event) => !panelOpenRef.current && !Object.values(settingsRef.current.bindings).some((b) => b.code === event.keyCode),
    );
    gameRef.current = game;
    return () => {
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

  return (
    <div ref={rootRef} style={{ position: 'relative', width: '100vw', height: '100vh', background: '#000' }}>
      <div ref={parentRef} style={{ width: '100%', height: '100%' }} />
      <MatchSettingsPanel settings={settings} onChange={onChange} open={panelOpen} onOpenChange={setPanelOpen} />
    </div>
  );
}
