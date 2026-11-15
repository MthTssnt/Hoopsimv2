import { TEAM_SEEDS } from '../../engine/teamsData';
const assets = import.meta.glob('../../assets/branding/teams/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export const franchiseBrand = Object.fromEntries(TEAM_SEEDS.map(team => [team.id, {
  ...team.colors, id: team.id, abbr: team.abbr, name: `${team.city} ${team.name}`,
  logo: assets[`../../assets/branding/teams/${team.id}.svg`],
}]));
export function brandFor(team: { id?: string; abbr: string }) {
  return franchiseBrand[team.id ?? ''] ?? Object.values(franchiseBrand).find(brand => brand.abbr === team.abbr);
}
