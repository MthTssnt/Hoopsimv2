import { useCallback, useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { VIEW_HEIGHT, VIEW_WIDTH } from './config';
import { HudScene } from './scenes/HudScene';
import { MatchScene } from './scenes/MatchScene';
import { loadSettings, saveSettings, type MatchSettings } from './settings';
import { MatchSettingsPanel } from './ui/MatchSettings';

/**
 * Monte une instance Phaser dans React et la détruit proprement au démontage.
 * Les réglages vivent ici (sauvegardés) et passent au jeu par `game.registry`.
 */
export default function PhaserGame() {
  const parentRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [settings, setSettings] = useState<MatchSettings>(loadSettings);
  const [panelOpen, setPanelOpen] = useState(false);
  const initialSettings = useRef(settings);

  useEffect(() => {
    if (!parentRef.current) return;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: parentRef.current,
      width: VIEW_WIDTH,
      height: VIEW_HEIGHT,
      pixelArt: true,
      backgroundColor: '#1d1d2b',
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: [MatchScene, HudScene],
    });
    game.registry.set('settings', initialSettings.current);
    // Le jeu peut demander un changement de réglage (ex. touche C pour la caméra).
    game.events.on('request-settings', (next: MatchSettings) => setSettings(next));
    gameRef.current = game;
    return () => {
      gameRef.current = null;
      game.destroy(true);
    };
  }, []);

  useEffect(() => {
    saveSettings(settings);
    gameRef.current?.registry.set('settings', settings);
  }, [settings]);

  useEffect(() => {
    gameRef.current?.registry.set('inputBlocked', panelOpen);
  }, [panelOpen]);

  const onChange = useCallback((next: MatchSettings) => setSettings(next), []);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <div ref={parentRef} style={{ width: '100%', height: '100%' }} />
      <MatchSettingsPanel settings={settings} onChange={onChange} open={panelOpen} onOpenChange={setPanelOpen} />
    </div>
  );
}
