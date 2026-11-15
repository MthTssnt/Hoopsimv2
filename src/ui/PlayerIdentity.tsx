import { playerName, type Player } from '../engine';
import { Rating } from './common';
export function PlayerIdentity({ player, onOpen }: { player: Player; onOpen?: () => void }) {
 return <div className="player-identity"><span className="jersey-number" aria-hidden="true">{player.number}</span><div>{onOpen ? <button className="player-name" onClick={onOpen}>{playerName(player)}</button> : <strong>{playerName(player)}</strong>}<div className="faint small">{player.pos} · {player.age} ans · {player.archetype}</div></div><span className="player-rating"><Rating value={player.overall}/><small>NOTE</small></span></div>;
}
