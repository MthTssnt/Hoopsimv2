import { store } from '../state/store';

/** Le match de ton équipe du jour : le jouer, le regarder (CPU contre CPU) ou le simuler. */
export function MatchButtons({ small = false }: { small?: boolean }) {
  const size = small ? ' btn-sm' : '';
  return (
    <>
      <button className={`btn btn-primary${size}`} onClick={() => store.startLiveMatch('jouer')}>
        Jouer
      </button>
      <button className={`btn${size}`} onClick={() => store.startLiveMatch('regarder')} title="CPU contre CPU">
        Regarder
      </button>
      <button className={`btn${size}`} onClick={() => store.advanceOneDay(true)} title="Résultat de la simulation, avec le déroulé">
        Simuler
      </button>
    </>
  );
}
