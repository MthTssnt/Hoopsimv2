import { useState } from 'react';
import { draftDecision, recommendedProspect } from '../../engine/development/draft';
import { TRAINING_LABELS, TRAINING_ATTRIBUTES, recommendTraining } from '../../engine/development/training';
import { TRAINING_FOCI, type TrainingFocus } from '../../engine/development/types';
import { budget, DIRECTION_LABELS } from '../../engine/management/economy';
import { playerName, POSITIONS, type League, type Team } from '../../engine/types';
import { store } from '../../state/store';
import { useUi } from '../uiContext';

export function DevelopmentTab({ league, team, initialTab }: { league: League; team: Team; initialTab?: 'training' | 'draft' | 'reviews' }) {
  const ui = useUi();
  const [tab, setTab] = useState<'training' | 'draft' | 'reviews'>(initialTab ?? (league.phase === 'offseason' ? 'draft' : 'training'));
  const [message, setMessage] = useState(''), [position, setPosition] = useState('');
  const [reviewSeason, setReviewSeason] = useState<number | null>(null);
  const d = league.offseason, pick = d?.picks[d.cursor];
  const yourPick = pick?.ownerTeamId === league.userTeamId;
  const finances = budget(league, team), recommendation = yourPick ? recommendedProspect(league, team) : undefined;
  const review = league.seasonReviews?.find(r => r.season === reviewSeason) ?? league.seasonReviews?.at(-1);
  const respond = (errors: string[], text: string) => {setMessage(errors.length ? errors.join(' ') : text);if(errors.length)ui.reportFailure(errors.join(' '));else ui.reportDecision(text);};
  return <div className="grid" style={{ gap: 16 }}>
    <section className="panel"><h2 className="panel-title">Développement et intersaison</h2>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>{([['training', 'Entraînement'], ['draft', 'Draft'], ['reviews', 'Bilans de saison']] as const).map(([id, label]) => <button key={id} className={`btn${tab === id ? ' btn-primary' : ''}`} aria-pressed={tab === id} onClick={() => { setTab(id); setMessage(''); }}>{label}</button>)}</div>
      {message && <p role="status">{message}</p>}
    </section>
    {tab === 'training' && <section className="panel"><h3 className="panel-title">Focus individuels</h3>
      <p>Un focus oriente la progression à l’intersaison selon les journées réellement entraînées, le potentiel, l’âge et les minutes jouées. Il ne garantit aucun gain. Les attributs élevés ont moins de marge ; le déclin physique des vétérans demeure.</p>
      <p className="faint small">Changer de focus n’ajoute ni attribut ni journée. Les journées régulières comptent une fois ; une journée avec blessure compte pour un quart. Les playoffs et l’intersaison n’ajoutent pas d’exposition. « Conseiller » cible le groupe d’attributs le plus faible, « Équilibré » réinitialise le choix futur.</p>
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Tableau de développement"><table><thead><tr><th className="left">Joueur</th><th>Âge</th><th>Note/Pot.</th><th>Minutes équiv. 48 min</th><th>Focus futur</th><th>Journées cumulées par focus</th><th>Aide</th></tr></thead><tbody>{team.roster.map(id => league.players[id]).map(p => <tr key={p.id}>
        <td className="left"><button className="btn btn-sm" onClick={() => ui.openPlayer(p.id)}>{playerName(p)}</button></td><td>{p.age}</td><td>{p.overall}/{p.potential}</td><td>{Math.round((p.developmentSeconds ?? p.stats.secs) / 60)}</td>
        <td><select aria-label={`Focus ${playerName(p)}`} value={p.training?.focus ?? 'balanced'} onChange={e => respond(store.setTraining(p.id, e.target.value as TrainingFocus), 'Focus enregistré pour les prochaines journées.')}>{TRAINING_FOCI.map(f => <option key={f} value={f}>{TRAINING_LABELS[f]}</option>)}</select></td>
        <td>{Object.entries(p.training?.days ?? {}).map(([f, days]) => `${TRAINING_LABELS[f as TrainingFocus]} : ${days?.toFixed(1)}`).join(' · ') || 'Aucune journée'}</td>
        <td><button className="btn btn-sm" onClick={() => respond(store.setTraining(p.id, recommendTraining(p)), 'Conseil appliqué au focus futur.')}>Conseiller</button> <button className="btn btn-sm" onClick={() => respond(store.setTraining(p.id, 'balanced'), 'Focus équilibré enregistré.')}>Équilibré</button></td>
      </tr>)}</tbody></table></div>
      <p className="faint small">{TRAINING_FOCI.filter(f => f !== 'balanced').map(f => `${TRAINING_LABELS[f]} : ${TRAINING_ATTRIBUTES[f].length} attributs ciblés`).join(' · ')}. Les bilans montrent les évolutions observées, sans les attribuer entièrement au focus.</p>
    </section>}
    {tab === 'draft' && <section className="panel"><h3 className="panel-title">Draft {league.season + 1}</h3><ol className="stepper" aria-label="Étapes de l’intersaison"><li aria-current={!d?'step':undefined}>1. Prolongations</li><li aria-current={d?.stage==='draft'?'step':undefined}>2. Draft</li><li aria-current={d?.stage==='ready'?'step':undefined}>3. Effectif et saison</li></ol>
      <p>Budget : {finances.payroll.toFixed(1)} / {finances.cap.toFixed(1)} M€ · effectif {team.roster.length}/15 · engagements futurs {finances.commitments.slice(1).map(v => v.toFixed(1)).join(' / ')} M€.</p>
      <p className="faint small">Deux tours, ordre inverse des bilans avec loterie des quatre derniers. Les choix appartiennent au club d’origine et ne sont pas échangeables. Le scouting donne une estimation fixe, avec sa marge d’incertitude ; la note actuelle et les attributs sont observés.</p>
      {!d && (league.phase === 'offseason' ? <><p>Dernière fenêtre de prolongation : négociez dans Marché avant la préparation. Préparer applique une seule fois progression, retraites et expirations, puis génère les 60 prospects. Vous pourrez les consulter avant de faire avancer les choix CPU.</p><button className="btn btn-primary" onClick={() => respond(store.prepareDraft(), 'Les 60 prospects sont consultables ; faites ensuite avancer les choix CPU.')}>Préparer la draft</button></> : <p>Les prospects seront disponibles à l’intersaison, après les playoffs.</p>)}
      {d?.stage === 'draft' && pick && <><p>Choix {pick.number}/{d.picks.length} · tour {pick.round} · {league.teams.find(t => t.id === pick.ownerTeamId)?.name}. Votre projet : {DIRECTION_LABELS[team.frontOffice?.direction ?? 'compete']}.</p>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}><label>Poste <select aria-label="Poste du prospect" value={position} onChange={e => setPosition(e.target.value)}><option value="">Tous</option>{POSITIONS.map(pos => <option key={pos}>{pos}</option>)}</select></label>
          {!yourPick && <button className="btn btn-primary" onClick={() => respond(store.advanceDraft(pick.id), 'Les CPU ont avancé jusqu’à votre prochain choix.')}>Faire avancer les choix CPU</button>}
          {recommendation && <button className="btn" onClick={() => respond(store.selectRookie(pick.id, recommendation.player.id), 'Choix conseillé sélectionné ; les CPU ont avancé.')}>Sélectionner le choix conseillé : {playerName(recommendation.player)}</button>}
          {yourPick && <><button className="btn" onClick={() => {if(confirm('Passer ce choix sans sélectionner de joueur ?'))respond(store.selectRookie(pick.id, null), 'Choix passé ; les CPU ont avancé.');}}>Passer mon choix</button>
          <button className="btn" onClick={() => {if(confirm('Déléguer tous vos choix restants à l’ordinateur et terminer la draft ?'))respond(store.delegateDraft(pick.id), 'Vos choix restants ont été délégués ; draft terminée.');}}>Déléguer mes choix restants</button></>}
        </div>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Tableau de développement"><table><thead><tr><th className="left">Prospect</th><th>Poste/âge</th><th>Note</th><th>Potentiel estimé</th><th>Profil observé</th><th>Contrat rookie</th><th>Décision</th></tr></thead><tbody>{Object.values(d.prospects).filter(p => !position || p.player.pos === position).sort((a, b) => b.estimatedPotential + b.player.overall - a.estimatedPotential - a.player.overall || a.player.id.localeCompare(b.player.id)).map(({ player: p, estimatedPotential, uncertainty }) => {
          const errors = draftDecision(league, pick.id, p.id);
          return <tr key={p.id}><td className="left">{playerName(p)}</td><td>{p.pos} · {p.age}</td><td>{p.overall}</td><td>{estimatedPotential} ± {uncertainty}</td><td className="small">3 pts {p.attrs.three} · finition {p.attrs.inside} · passe {p.attrs.passing} · défense {p.attrs.perimeterDef}/{p.attrs.interiorDef}</td><td>{p.contract.salary.toFixed(1)} M€ × {p.contract.years} ans</td><td>{!yourPick ? <span className="faint small">À consulter avant votre choix</span> : errors.length ? <span className="faint small">{errors.join(' ')}</span> : <button className="btn btn-sm" aria-label={`Sélectionner ${playerName(p)}`} onClick={() => respond(store.selectRookie(pick.id, p.id), 'Joueur sélectionné et sauvegardé ; les CPU ont avancé.')}>Sélectionner</button>}</td></tr>;
        })}</tbody></table></div>
      </>}
      {d?.stage === 'ready' && <><p>Draft terminée. Les non-sélectionnés sont agents libres. Vous pouvez recruter dans Marché ; les déficits sous 13 seront complétés par des renforts minimaux tracés au lancement.</p><button className="btn btn-primary" onClick={() => respond(store.launchSeason(), 'Nouvelle saison lancée.')}>Lancer la saison {league.season + 1}</button></>}
      {d && <><h4>Ordre et résultats</h4><div className="table-wrap" tabIndex={0} role="region" aria-label="Tableau de développement"><table><thead><tr><th>#</th><th>Club propriétaire</th><th>Choix</th><th className="left">Motif</th></tr></thead><tbody>{d.picks.map((p, i) => <tr key={p.id} className={i === d.cursor ? 'highlight' : ''}><td>{p.number}</td><td>{league.teams.find(t => t.id === p.ownerTeamId)?.abbr}</td><td>{p.player?.name ?? (i < d.cursor ? 'Passé' : 'À venir')}</td><td className="left small">{p.reason ?? '—'}</td></tr>)}</tbody></table></div></>}
    </section>}
    {tab === 'reviews' && <section className="panel"><h3 className="panel-title">Bilans archivés</h3><p className="faint small">Les dix derniers bilans sont conservés, avec noms et notes au moment de la saison. Les minutes couvrent la saison régulière, normalisées à 48 min pour les matchs physiques ; les changements sont observés après progression, pas une preuve de causalité du focus.</p>
      <label>Saison <select aria-label="Saison du bilan" value={review?.season ?? ''} onChange={e => setReviewSeason(Number(e.target.value))}>{!review && <option value="">Aucun bilan</option>}{[...(league.seasonReviews ?? [])].reverse().map(r => <option key={r.season} value={r.season}>{r.season}</option>)}</select></label>
      {review && <><p>{review.retiredCount} départ(s) à la retraite · {review.draft.filter(p => p.player).length} joueurs draftés.</p><h4>Votre développement</h4><div className="table-wrap" tabIndex={0} role="region" aria-label="Tableau de développement"><table><thead><tr><th className="left">Joueur</th><th>Note avant → après</th><th>Focus dominant</th><th>Journées</th><th>Minutes équiv. 48 min</th></tr></thead><tbody>{review.development.map(p => <tr key={p.id}><td className="left">{p.name}</td><td>{p.before} → {p.after}</td><td>{TRAINING_LABELS[p.focus]}</td><td>{p.trainingDays}</td><td>{p.minutes}</td></tr>)}</tbody></table></div>
        <h4>Les franchises à la clôture</h4><div className="table-wrap" tabIndex={0} role="region" aria-label="Tableau de développement"><table><thead><tr><th>Club</th><th>Bilan</th><th>Projet</th><th>Âge moyen</th><th>Masse salariale</th><th>Meilleur marqueur</th></tr></thead><tbody>{review.teams.map(t => <tr key={t.teamId}><td>{league.teams.find(team => team.id === t.teamId)?.abbr}</td><td>{t.wins}-{t.losses}</td><td>{DIRECTION_LABELS[t.direction]}</td><td>{t.averageAge.toFixed(1)}</td><td>{t.payroll.toFixed(1)} M€</td><td>{t.scorer ? `${t.scorer.name} · ${t.scorer.pointsPerGame.toFixed(1)} pts/m` : '—'}</td></tr>)}</tbody></table></div>
        <h4>Draft de cette intersaison</h4>{review.draft.filter(p => p.ownerTeamId === team.id).map(p => <p key={p.id}>Choix {p.number} : {p.player?.name ?? 'Passé'} · {p.reason}</p>)}</>}
    </section>}
  </div>;
}
