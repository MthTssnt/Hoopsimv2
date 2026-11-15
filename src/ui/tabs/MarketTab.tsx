import { useState } from 'react';
import { contractSeason, budget, DIRECTION_LABELS, expectedSalary, LEAGUE_ECONOMY_CONFIG as CONFIG, playerValue, tradeStatus } from '../../engine/management/economy';
import { evaluateContract, evaluateTrade, marketOpen } from '../../engine/management/transactions';
import type { ContractOffer, FrontOfficeDirection, TradeOffer, TradeStatus } from '../../engine/management/types';
import { PLAYER_ROLES } from '../../engine/gamePlan';
import { POSITIONS, playerName, type League, type Player, type Team } from '../../engine/types';
import { store } from '../../state/store';
import { useUi } from '../uiContext';

export const TRADE_STATUS_LABELS: Record<TradeStatus, string> = { normal: 'À l’écoute', listed: 'Liste des transferts', core: 'Noyau dur', unavailable: 'Indisponible' };
export const CONTRACT_ROLES = ['Créateur principal', 'Créateur secondaire', 'Tireur', 'Pénétrateur', 'Intérieur sur écran', 'Scoreur au poste', 'Stoppeur', 'Rebondeur', 'Sixième homme', 'Équipier'];

export function MarketTab({ league, team }: { league: League; team: Team }) {
  const ui = useUi();
  const [tab, setTab] = useState<'players' | 'trades' | 'contracts' | 'history'>('players');
  const [search, setSearch] = useState(''), [position, setPosition] = useState(''), [club, setClub] = useState('all');
  const [maxAge, setMaxAge] = useState(40), [maxSalary, setMaxSalary] = useState(60), [minPotential, setMinPotential] = useState(25), [minValue, setMinValue] = useState(0);
  const [listedOnly, setListedOnly] = useState(false);
  const [otherId, setOtherId] = useState(league.teams.find(t => t.id !== team.id)!.id);
  const [outgoing, setOutgoing] = useState<string[]>([]), [incoming, setIncoming] = useState<string[]>([]);
  const [playerId, setPlayerId] = useState('');
  const [offer, setOffer] = useState<ContractOffer>({ salary: 1, years: 2, promisedRole: 'rolePlayer' });
  const [message, setMessage] = useState('');
  const finances = budget(league, team), other = league.teams.find(t => t.id === otherId)!;
  const trade: TradeOffer = { fromTeamId: team.id, toTeamId: otherId, outgoingIds: outgoing, incomingIds: incoming };
  const preview = evaluateTrade(league, trade), selected = league.players[playerId];
  const contract = selected ? evaluateContract(league, team.id, playerId, offer) : null;
  const respond = (errors: string[], success: string) => setMessage(errors.length ? errors.join(' ') : success);
  const selectContract = (player: Player) => { setPlayerId(player.id); setOffer({ salary: expectedSalary(player), years: player.age < 27 ? 2 : 1, promisedRole: 'rolePlayer' }); setTab('contracts'); setMessage(''); };
  const toggle = (ids: string[], id: string, setter: (ids: string[]) => void) => setter(ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  const available = Object.values(league.players).filter(p => (!search || playerName(p).toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr'))) && (!position || p.pos === position) && (club === 'all' || (club === 'free' ? p.teamId === null : p.teamId === club)) && p.age <= maxAge && (p.teamId ? p.contract.salary : expectedSalary(p)) <= maxSalary && p.potential >= minPotential && playerValue(p, team.frontOffice?.direction) >= minValue && (!listedOnly || tradeStatus(league, p) === 'listed'))
    .sort((a, b) => playerValue(b, team.frontOffice?.direction) - playerValue(a, team.frontOffice?.direction) || a.id.localeCompare(b.id));
  return <div className="grid" style={{ gap: 16 }}>
    <section className="panel">
      <h2 className="panel-title">Marché — {team.name}</h2>
      <p>Budget fictif : plafond {finances.cap.toFixed(1)} M€ · masse salariale {finances.payroll.toFixed(1)} M€ · disponible {finances.space.toFixed(1)} M€ · effectif {team.roster.length}/{CONFIG.maxRoster} (minimum {CONFIG.minRoster}).</p>
      <p className="faint small">Signatures ordinaires sous plafond, y compris les exercices futurs. Seuls des renforts de secours au minimum, pour un an, peuvent le dépasser afin d’atteindre 13 joueurs. Les échanges ferment après les trois quarts du calendrier ; aucune signature en playoffs.</p>
      {team.roster.some(id => league.players[id].legacyMinimum) && <p className="faint small">Les anciens contrats sous 0,8 M€ sont conservés jusqu’à leur expiration ; le nouveau minimum concerne les contrats à venir.</p>}
      <p>Engagements : {finances.commitments.map((sum, i) => `${contractSeason(league) + i} : ${sum.toFixed(1)} M€`).join(' · ')}</p>
      <label>Projet de franchise <select aria-label="Projet de franchise" value={team.frontOffice?.direction ?? 'compete'} onChange={e => respond(store.setFrontOffice(e.target.value as FrontOfficeDirection), 'Projet enregistré.')}>{Object.entries(DIRECTION_LABELS).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      {league.phase === 'offseason' && !league.offseason && <p>Fenêtre de prolongation : négociez vos contrats expirants avant « Préparer la draft ». Sans accord, ils deviennent agents libres. Un éventuel déficit sous 13 sera complété par des contrats minimaux tracés.</p>}
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 12 }}>{([['players', 'Joueurs et agents libres'], ['trades', 'Transferts'], ['contracts', 'Contrats'], ['history', 'Transactions']] as const).map(([id, name]) => <button key={id} className={`btn${tab === id ? ' btn-primary' : ''}`} onClick={() => { setTab(id); setMessage(''); }}>{name}</button>)}</div>
      {message && <p role="status">{message}</p>}
    </section>
    {league.offseason?.stage === 'draft' && <p role="status">La draft est en cours dans Développement. Les négociations reprendront une fois les choix terminés.</p>}
    {tab === 'players' && <section className="panel"><h3 className="panel-title">Recherche — {available.length} joueurs</h3>
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        <input aria-label="Rechercher un joueur" placeholder="Nom du joueur" value={search} onChange={e => setSearch(e.target.value)} />
        <select aria-label="Équipe recherchée" value={club} onChange={e => setClub(e.target.value)}><option value="all">Toutes les équipes</option><option value="free">Agents libres</option>{league.teams.map(t => <option key={t.id} value={t.id}>{t.city} {t.name}</option>)}</select>
        <select aria-label="Poste recherché" value={position} onChange={e => setPosition(e.target.value)}><option value="">Tous les postes</option>{POSITIONS.map(pos => <option key={pos}>{pos}</option>)}</select>
        <label>Âge max <input style={{ width: 55 }} type="number" min={19} max={45} aria-label="Âge maximum" value={maxAge} onChange={e => setMaxAge(Number(e.target.value))} /></label>
        <label>Salaire max <input style={{ width: 55 }} type="number" min={0} max={60} aria-label="Salaire maximum" value={maxSalary} onChange={e => setMaxSalary(Number(e.target.value))} /></label>
        <label>Potentiel min <input style={{ width: 55 }} type="number" min={25} max={99} aria-label="Potentiel minimum" value={minPotential} onChange={e => setMinPotential(Number(e.target.value))} /></label>
        <label>Valeur min <input style={{ width: 55 }} type="number" min={0} aria-label="Valeur minimum" value={minValue} onChange={e => setMinValue(Number(e.target.value))} /></label>
        <label><input type="checkbox" checked={listedOnly} onChange={e => setListedOnly(e.target.checked)} /> Liste des transferts uniquement</label>
      </div>
      <p className="faint small">La valeur est un indice de négociation selon votre projet, distinct de la note globale. Les demandes salariales ne sont pas un contrat signé.</p>
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Tableau du marché"><table><thead><tr><th className="left">Joueur</th><th>Équipe</th><th>Âge</th><th>Note/Pot.</th><th>Valeur</th><th>Salaire/ans</th><th>Statut</th><th>Action</th></tr></thead><tbody>{available.slice(0, 100).map(p => <tr key={p.id}>
        <td className="left"><button className="btn btn-sm" onClick={() => ui.openPlayer(p.id)}>{playerName(p)}</button> {p.pos}</td><td>{league.teams.find(t => t.id === p.teamId)?.abbr ?? 'Libre'}</td><td>{p.age}</td><td>{p.overall}/{p.potential}</td><td>{playerValue(p, team.frontOffice?.direction).toFixed(1)}</td><td>{p.teamId ? `${p.contract.salary.toFixed(1)} M€ / ${p.contract.years}` : `Demande ${expectedSalary(p).toFixed(1)} M€`}</td>
        <td>{p.teamId === team.id ? <select aria-label={`Statut ${playerName(p)}`} value={tradeStatus(league, p)} onChange={e => respond(store.setTradeStatus(p.id, e.target.value as TradeStatus), 'Statut enregistré.')}>{Object.entries(TRADE_STATUS_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select> : p.teamId ? TRADE_STATUS_LABELS[tradeStatus(league, p)] : 'Agent libre'}</td>
        <td>{p.teamId === null || p.teamId === team.id && p.contract.years === 1 && !p.extension ? <button className="btn btn-sm" onClick={() => selectContract(p)}>{p.teamId ? 'Prolonger' : 'Offrir un contrat'}</button> : p.teamId && p.teamId !== team.id ? <button className="btn btn-sm" onClick={() => { setOtherId(p.teamId!); setIncoming([p.id]); setOutgoing([]); setTab('trades'); }}>Proposer un échange</button> : '—'}</td>
      </tr>)}</tbody></table></div>{available.length > 100 && <p className="faint small">100 premiers résultats affichés ; affinez les filtres pour retrouver les autres joueurs.</p>}
    </section>}
    {tab === 'trades' && <section className="panel"><h3 className="panel-title">Composer une offre</h3>
      {!marketOpen(league) && <p role="alert">La fenêtre des échanges est fermée.</p>}
      <label>Franchise partenaire <select aria-label="Franchise partenaire" value={otherId} onChange={e => { setOtherId(e.target.value); setIncoming([]); }}>{league.teams.filter(t => t.id !== team.id).map(t => <option key={t.id} value={t.id}>{t.city} {t.name} — {DIRECTION_LABELS[t.frontOffice?.direction ?? 'compete']}</option>)}</select></label>
      {other.frontOffice?.decisionReason && <p className="faint small">Dernière décision de {other.abbr} : {other.frontOffice.decisionReason}</p>}
      <div className="grid grid-2" style={{ marginTop: 12 }}>{([[team, outgoing, setOutgoing], [other, incoming, setIncoming]] as const).map(([side, ids, setter]) => <div key={side.id}><h4>{side.name} — {ids.length}/3 sélectionnés</h4>{side.roster.map(id => league.players[id]).map(p => <label key={p.id} style={{ display: 'block', marginBottom: 8 }}><input type="checkbox" aria-label={`Échanger ${side.abbr} ${playerName(p)}`} checked={ids.includes(p.id)} disabled={['core', 'unavailable'].includes(tradeStatus(league, p)) || !ids.includes(p.id) && ids.length >= 3} onChange={() => toggle(ids, p.id, setter)} /> {playerName(p)} · {p.pos} · {p.overall}/{p.potential} · {p.contract.salary.toFixed(1)} M€ · {TRADE_STATUS_LABELS[tradeStatus(league, p)]}</label>)}</div>)}</div>
      <p>Salaires pour votre équipe : entrant {preview.salaryIn.toFixed(1)} M€ / sortant {preview.salaryOut.toFixed(1)} M€.</p>
      {Object.entries(preview.projectedPayrolls).map(([id, sums]) => <p key={id} className="faint small">{league.teams.find(t => t.id === id)?.abbr} après échange : {sums.map((v, year) => `${contractSeason(league) + year} : ${v.toFixed(1)} M€`).join(' · ')}</p>)}
      {outgoing.length > 0 && incoming.length > 0 && <p role="note">{preview.accepted ? `Accord estimé : valeur reçue par ${other.abbr} ${preview.receivedValue.toFixed(1)}, cédée ${preview.sentValue.toFixed(1)}.` : preview.reasons.join(' ')}</p>}
      <button className="btn btn-primary" disabled={!marketOpen(league) || !outgoing.length || !incoming.length} onClick={() => { const errors = store.proposeTrade(trade); respond(errors, 'Échange accepté et enregistré.'); if (!errors.length) { setOutgoing([]); setIncoming([]); } }}>Envoyer l’offre</button>
      <h4>Offres reçues</h4>{!league.management?.proposals.length && <p className="faint small">Aucune offre en attente. Les autres franchises agissent lors des fenêtres de marché.</p>}{league.management?.proposals.map(p => <div key={p.id} className="panel"><p>{league.teams.find(t => t.id === p.offer.fromTeamId)?.name} propose {p.offer.outgoingIds.map(id => league.players[id] ? playerName(league.players[id]) : id).join(', ')} contre {p.offer.incomingIds.map(id => league.players[id] ? playerName(league.players[id]) : id).join(', ')}.</p><button className="btn btn-sm" onClick={() => respond(store.respondTradeProposal(p.id, true), 'Offre acceptée.')}>Accepter l’offre</button> <button className="btn btn-sm" onClick={() => respond(store.respondTradeProposal(p.id, false), 'Offre refusée.')}>Refuser l’offre</button></div>)}
    </section>}
    {tab === 'contracts' && <section className="panel"><h3 className="panel-title">Agents libres et prolongations</h3>
      <p className="faint small">Les prolongations commencent en {contractSeason(league) + 1}. Une nouvelle négociation sur le même contrat est impossible après signature. Un refus est déterministe dans l’état actuel de la ligue.</p>
      <label>Joueur à négocier <select aria-label="Joueur à négocier" value={playerId} onChange={e => { const player = league.players[e.target.value]; if (player) selectContract(player); else setPlayerId(''); }}><option value="">Choisir un joueur</option>{Object.values(league.players).filter(p => p.teamId === null || p.teamId === team.id && p.contract.years === 1 && !p.extension).map(p => <option key={p.id} value={p.id}>{playerName(p)} · {p.teamId ? 'prolongation' : 'agent libre'}</option>)}</select></label>
      {selected && <><p>{playerName(selected)} · demande {expectedSalary(selected).toFixed(1)} M€ · {selected.teamId ? 'prend effet la saison suivante' : 'signature immédiate'}.</p><div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
        <label>Salaire annuel M€ <input aria-label="Salaire proposé" type="number" min={0.8} max={60} step={0.1} value={Number.isFinite(offer.salary) ? offer.salary : ''} onChange={e => setOffer({ ...offer, salary: e.target.value === '' ? NaN : Number(e.target.value) })} /></label>
        <label>Années <input aria-label="Années proposées" type="number" min={1} max={4} step={1} value={Number.isFinite(offer.years) ? offer.years : ''} onChange={e => setOffer({ ...offer, years: e.target.value === '' ? NaN : Number(e.target.value) })} /></label>
        <label>Rôle promis <select aria-label="Rôle promis" value={offer.promisedRole} onChange={e => setOffer({ ...offer, promisedRole: e.target.value as ContractOffer['promisedRole'] })}>{PLAYER_ROLES.map((role, i) => <option key={role} value={role}>{CONTRACT_ROLES[i]}</option>)}</select></label>
      </div><p>{contract?.accepted ? 'Le joueur est disposé à accepter cette offre.' : contract?.reasons.join(' ')}</p><p className="faint small">Engagements après offre : {contract?.projectedPayroll.map((v, year) => `${contractSeason(league) + year} : ${Number.isFinite(v) ? v.toFixed(1) : '—'} M€`).join(' · ')}</p><button className="btn btn-primary" onClick={() => respond(store.offerContract(playerId, offer), 'Contrat signé et enregistré.')}>Transmettre le contrat</button></>}
      <h4>Contrats de votre équipe</h4><div className="table-wrap" tabIndex={0} role="region" aria-label="Tableau du marché"><table><thead><tr><th className="left">Joueur</th><th>Salaire</th><th>Ans restants</th><th>Prolongation signée</th></tr></thead><tbody>{team.roster.map(id => league.players[id]).map(p => <tr key={p.id}><td className="left">{playerName(p)}</td><td>{p.contract.salary.toFixed(1)} M€</td><td>{p.contract.years}</td><td>{p.extension ? `${p.extension.salary.toFixed(1)} M€ × ${p.extension.years} an(s)` : p.contract.years === 1 ? <button className="btn btn-sm" onClick={() => selectContract(p)}>Prolonger</button> : '—'}</td></tr>)}</tbody></table></div>
    </section>}
    {tab === 'history' && <section className="panel"><h3 className="panel-title">Historique des transactions</h3><p className="faint small">Les {CONFIG.retainedTransactions} dernières opérations de la ligue sont conservées.</p>{[...(league.management?.transactions ?? [])].reverse().map(e => <p key={e.id}><span className="faint small">Saison {e.season}, jour {e.day + 1} · </span>{e.description}</p>)}</section>}
  </div>;
}
