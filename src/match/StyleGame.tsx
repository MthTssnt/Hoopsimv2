import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { ART_VIEW } from './render/artConfig';
import { StyleScene } from './scenes/StyleScene';

/** Plus grand facteur entier qui fait tenir 640×360 dans la fenêtre (pixels toujours nets). */
function integerZoom(): number {
  return Math.max(1, Math.floor(Math.min(window.innerWidth / ART_VIEW.width, window.innerHeight / ART_VIEW.height)));
}

/**
 * Scène `?style` : validation à l'œil de la direction artistique, en 640×360 mis à l'échelle
 * entière. F bascule en plein écran (×3 en 1080p, alors qu'une fenêtre de navigateur n'offre
 * souvent que ×2).
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
      scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.CENTER_BOTH, zoom: integerZoom(), fullscreenTarget: parentRef.current },
      scene: [StyleScene],
    });
    const onResize = () => game.scale.setZoom(integerZoom());
    // Écouteur DOM direct : la demande de plein écran doit partir de l'appui lui-même.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'f' || event.key === 'F') game.scale.toggleFullscreen();
    };
    window.addEventListener('resize', onResize);
    document.addEventListener('fullscreenchange', onResize);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', onResize);
      document.removeEventListener('fullscreenchange', onResize);
      window.removeEventListener('keydown', onKey);
      game.destroy(true);
    };
  }, []);

  return <div ref={parentRef} style={{ width: '100vw', height: '100vh', background: '#000' }} />;
}
