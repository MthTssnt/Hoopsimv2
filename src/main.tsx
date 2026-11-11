import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App';
import './styles.css';

// Modes de test du rendu Phaser, chargés à part pour ne pas alourdir le jeu de gestion :
// ?court pour le match, ?style pour la planche de direction artistique, ?anims pour les gestes.
const PhaserGame = lazy(() => import('./match/PhaserGame'));
const PlayerDesigns = lazy(() => import('./ui/PlayerDesigns'));
const params = new URLSearchParams(window.location.search);
const TestScreen = params.has('style') || params.has('anims') ? PlayerDesigns : params.has('court') ? PhaserGame : null;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {TestScreen ? (
      <Suspense fallback={null}>
        <TestScreen />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
