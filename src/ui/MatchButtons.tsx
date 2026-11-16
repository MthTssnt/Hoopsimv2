import { store } from '../state/store';

/** Le match de ton équipe du jour : le jouer, le regarder (CPU contre CPU) ou le simuler. */
export function MatchButtons({ small = false, disabled=false }: { small?: boolean; disabled?:boolean }) {
  const size = small ? ' btn-sm' : '';
  return (
    <>
      <button disabled={disabled} className={`btn btn-primary${size}`} onClick={() => store.startLiveMatch('jouer')}>
        Jouer
      </button>
      <button disabled={disabled} className={`btn${size}`} onClick={() => store.startLiveMatch('regarder')} title="CPU contre CPU">
        Regarder
      </button>
      <button disabled={disabled} className={`btn${size}`} onClick={() => store.advanceOneDay(true)} title="Résultat de la simulation, avec le déroulé">
        Simuler
      </button>
    </>
  );
}
