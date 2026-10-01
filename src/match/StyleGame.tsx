import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { ART_VIEW } from './render/artConfig';
import { StyleScene } from './scenes/StyleScene';

/** Plus grand facteur entier qui fait tenir 384×216 dans la fenêtre (pixels toujours nets). */
function integerZoom(): number {
  return Math.max(1, Math.floor(Math.min(window.innerWidth / ART_VIEW.width, window.innerHeight / ART_VIEW.height)));
}

/** Scène `?style` : validation à l'œil de la direction artistique, en 384×216 mis à l'échelle entière. */
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
      scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.CENTER_BOTH, zoom: integerZoom() },
      scene: [StyleScene],
    });
    const onResize = () => game.scale.setZoom(integerZoom());
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      game.destroy(true);
    };
  }, []);

  return <div ref={parentRef} style={{ width: '100vw', height: '100vh', background: '#000' }} />;
}
