import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { ART_VIEW } from './render/artConfig';
import { StyleScene } from './scenes/StyleScene';
import { attachIntegerScaling, integerZoom } from './screen';

/**
 * Scène `?style` : validation à l'œil de la direction artistique, en 480×270 mis à l'échelle
 * entière. F bascule en plein écran (×4 en 1080p, alors qu'une fenêtre de navigateur n'offre
 * souvent que ×3).
 */
export default function StyleGame() {
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!parentRef.current) return;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: parentRef.current,
      width: ART_VIEW.width,
      height: ART_VIEW.height,
      pixelArt: true,
      backgroundColor: '#000000',
      scale: {
        mode: Phaser.Scale.NONE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        zoom: integerZoom(window.innerWidth, window.innerHeight, ART_VIEW.width, ART_VIEW.height),
        fullscreenTarget: parentRef.current,
      },
      scene: [StyleScene],
    });
    const detach = attachIntegerScaling(game, ART_VIEW);
    return () => {
      detach();
      game.destroy(true);
    };
  }, []);

  return <div ref={parentRef} style={{ width: '100vw', height: '100vh', background: '#000' }} />;
}
