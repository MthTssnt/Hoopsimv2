import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { VIEW_HEIGHT, VIEW_WIDTH } from './config';
import { MatchScene } from './scenes/MatchScene';

/** Monte une instance Phaser dans React et la détruit proprement au démontage. */
export default function PhaserGame() {
  const parentRef = useRef<HTMLDivElement>(null);

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
      scene: [MatchScene],
    });
    return () => game.destroy(true);
  }, []);

  return <div ref={parentRef} style={{ width: '100vw', height: '100vh' }} />;
}
