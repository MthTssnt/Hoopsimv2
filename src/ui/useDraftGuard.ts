import { useEffect } from 'react';
/** Presentation-only guard. Never writes to the career or silently applies a draft. */
export function useDraftGuard(dirty: boolean) {
 useEffect(() => {
  if (!dirty) return;
  const navigate = (event: Event) => { if (!confirm('Des modifications ne sont pas enregistrées. Quitter et abandonner ce brouillon ?')) event.preventDefault(); };
  const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
  window.addEventListener('hoopsim:before-navigate',navigate);
  window.addEventListener('beforeunload',unload);
  return () => { window.removeEventListener('hoopsim:before-navigate',navigate);window.removeEventListener('beforeunload',unload); };
 }, [dirty]);
}
