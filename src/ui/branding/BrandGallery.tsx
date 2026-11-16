import { franchiseBrand } from './franchiseBrand';
import { HoopSimLogo } from './HoopSimLogo';
import mark from '../../assets/branding/hoopsim-mark.svg';
export default function BrandGallery() {
  return <main className="brand-gallery"><HoopSimLogo width={380} /><h1>Clubhouse · 30 franchises</h1><p>Créations originales • palettes historiques • écussons 64 × 64 et variantes compactes 32 × 32</p>
    <section className="brand-grid">{Object.values(franchiseBrand).filter(b => b.logo).map(b => <article className="panel" key={b.id}><h2>{b.name}</h2><p>{b.id} / {b.abbr} / {b.primary} / {b.secondary}</p>{['#0c1421', '#f6f1de', b.primary, b.secondary].map(bg => <div className="brand-sizes" key={bg} style={{ background: bg }}>{[16,24,32,40,48,64,192].map(size => <img key={size} src={size<=32?b.compact:b.logo} width={size} height={size} alt={`${b.abbr} ${size} pixels`} style={{ imageRendering: 'pixelated' }} />)}</div>)}</article>)}</section>
    <h2>Symbole HoopSim</h2>{[16,24,32,40,48,64,192].map(s => <img src={mark} width={s} key={s} alt={`HoopSim ${s} px`} />)}<p><a href="/">Retour au jeu</a></p></main>;
}
