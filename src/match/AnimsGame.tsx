import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { ART_VIEW } from './render/artConfig';
import { AnimsScene } from './scenes/AnimsScene';
import { attachIntegerScaling, integerZoom } from './screen';

/**
 * Page `?anims` : les animations et les gestes du rendu 2D en boucle, à leur vrai rythme, en
 * 640×360 mis à l'échelle entière (F : plein écran). `&geste=layup` ouvre directement un geste.
 */
export default function AnimsGame() {
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
      scene: [AnimsScene],
    });
    const detach = attachIntegerScaling(game, ART_VIEW);
    return () => {
      detach();
      game.destroy(true);
    };
  }, []);

  return <div ref={parentRef} style={{ width: '100vw', height: '100vh', background: '#000' }} />;
}
