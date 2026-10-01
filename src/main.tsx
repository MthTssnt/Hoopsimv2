import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App';
import './styles.css';

// Mode test du rendu Phaser : ajouter ?court à l'URL. Phaser est chargé à part
// pour ne pas alourdir le jeu de gestion.
const PhaserGame = lazy(() => import('./match/PhaserGame'));
const courtTest = new URLSearchParams(window.location.search).has('court');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {courtTest ? (
      <Suspense fallback={null}>
        <PhaserGame />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
