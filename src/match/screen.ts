import type Phaser from 'phaser';

/** Plus grand facteur entier qui fait tenir la vue dans la fenêtre (pixels toujours nets), au moins ×1. */
export function integerZoom(windowWidth: number, windowHeight: number, viewWidth: number, viewHeight: number): number {
  return Math.max(1, Math.floor(Math.min(windowWidth / viewWidth, windowHeight / viewHeight)));
}

/**
 * Mise à l'échelle entière d'un jeu en `Scale.NONE` : recalcul au redimensionnement et à
 * l'entrée ou la sortie du plein écran ; F bascule en plein écran (écouteur DOM direct : la
 * demande doit partir de l'appui lui-même), sauf si `allowFullscreenKey` le refuse.
 * Renvoie la fonction qui retire les écouteurs.
 */
export function attachIntegerScaling(game: Phaser.Game, view: { width: number; height: number }, allowFullscreenKey: (event: KeyboardEvent) => boolean = () => true): () => void {
  const onResize = () => game.scale.setZoom(integerZoom(window.innerWidth, window.innerHeight, view.width, view.height));
  const onKey = (event: KeyboardEvent) => {
    if ((event.key === 'f' || event.key === 'F') && !event.repeat && allowFullscreenKey(event)) game.scale.toggleFullscreen();
  };
  window.addEventListener('resize', onResize);
  document.addEventListener('fullscreenchange', onResize);
  window.addEventListener('keydown', onKey);
  return () => {
    window.removeEventListener('resize', onResize);
    document.removeEventListener('fullscreenchange', onResize);
    window.removeEventListener('keydown', onKey);
  };
}
