import type { Conference } from './types';

export interface TeamSeed {
  id: string;
  city: string;
  name: string;
  abbr: string;
  conference: Conference;
  division: string;
  colors: { primary: string; secondary: string };
}

/** Les 30 franchises de la ligue (fictives). */
export const TEAM_SEEDS: TeamSeed[] = [
  // --- Conférence Est ---
  { id: 'nyk', city: 'New York', name: 'Monarchs', abbr: 'NYM', conference: 'Est', division: 'Atlantique', colors: { primary: '#1d4ed8', secondary: '#f59e0b' } },
  { id: 'bos', city: 'Boston', name: 'Ironsides', abbr: 'BOS', conference: 'Est', division: 'Atlantique', colors: { primary: '#047857', secondary: '#d1d5db' } },
  { id: 'phi', city: 'Philadelphie', name: 'Forge', abbr: 'PHI', conference: 'Est', division: 'Atlantique', colors: { primary: '#b91c1c', secondary: '#1f2937' } },
  { id: 'tor', city: 'Toronto', name: 'Timber', abbr: 'TOR', conference: 'Est', division: 'Atlantique', colors: { primary: '#7c3aed', secondary: '#e5e7eb' } },
  { id: 'bkn', city: 'Brooklyn', name: 'Voltage', abbr: 'BKN', conference: 'Est', division: 'Atlantique', colors: { primary: '#111827', secondary: '#facc15' } },

  { id: 'chi', city: 'Chicago', name: 'Gale', abbr: 'CHI', conference: 'Est', division: 'Centrale', colors: { primary: '#0ea5e9', secondary: '#0f172a' } },
  { id: 'det', city: 'Détroit', name: 'Gears', abbr: 'DET', conference: 'Est', division: 'Centrale', colors: { primary: '#dc2626', secondary: '#1e3a8a' } },
  { id: 'cle', city: 'Cleveland', name: 'Anvils', abbr: 'CLE', conference: 'Est', division: 'Centrale', colors: { primary: '#7f1d1d', secondary: '#fbbf24' } },
  { id: 'mil', city: 'Milwaukee', name: 'Frost', abbr: 'MIL', conference: 'Est', division: 'Centrale', colors: { primary: '#0d9488', secondary: '#f1f5f9' } },
  { id: 'ind', city: 'Indianapolis', name: 'Racers', abbr: 'IND', conference: 'Est', division: 'Centrale', colors: { primary: '#eab308', secondary: '#1e40af' } },

  { id: 'mia', city: 'Miami', name: 'Tide', abbr: 'MIA', conference: 'Est', division: 'Sud-Est', colors: { primary: '#db2777', secondary: '#0f172a' } },
  { id: 'atl', city: 'Atlanta', name: 'Ember', abbr: 'ATL', conference: 'Est', division: 'Sud-Est', colors: { primary: '#ea580c', secondary: '#111827' } },
  { id: 'orl', city: 'Orlando', name: 'Comets', abbr: 'ORL', conference: 'Est', division: 'Sud-Est', colors: { primary: '#2563eb', secondary: '#e2e8f0' } },
  { id: 'cha', city: 'Charlotte', name: 'Rangers', abbr: 'CHA', conference: 'Est', division: 'Sud-Est', colors: { primary: '#4338ca', secondary: '#14b8a6' } },
  { id: 'was', city: 'Washington', name: 'Sentinels', abbr: 'WAS', conference: 'Est', division: 'Sud-Est', colors: { primary: '#991b1b', secondary: '#1d4ed8' } },

  // --- Conférence Ouest ---
  { id: 'den', city: 'Denver', name: 'Summits', abbr: 'DEN', conference: 'Ouest', division: 'Nord-Ouest', colors: { primary: '#1e3a8a', secondary: '#fcd34d' } },
  { id: 'por', city: 'Portland', name: 'Pioneers', abbr: 'POR', conference: 'Ouest', division: 'Nord-Ouest', colors: { primary: '#b91c1c', secondary: '#0f172a' } },
  { id: 'sea', city: 'Seattle', name: 'Sound', abbr: 'SEA', conference: 'Ouest', division: 'Nord-Ouest', colors: { primary: '#15803d', secondary: '#fde047' } },
  { id: 'slc', city: 'Salt Lake', name: 'Peaks', abbr: 'SLC', conference: 'Ouest', division: 'Nord-Ouest', colors: { primary: '#0f766e', secondary: '#e5e7eb' } },
  { id: 'min', city: 'Minneapolis', name: 'Aurora', abbr: 'MIN', conference: 'Ouest', division: 'Nord-Ouest', colors: { primary: '#4c1d95', secondary: '#22d3ee' } },

  { id: 'lal', city: 'Los Angeles', name: 'Royals', abbr: 'LAR', conference: 'Ouest', division: 'Pacifique', colors: { primary: '#6d28d9', secondary: '#facc15' } },
  { id: 'sfo', city: 'Bay City', name: 'Current', abbr: 'BAY', conference: 'Ouest', division: 'Pacifique', colors: { primary: '#1d4ed8', secondary: '#fbbf24' } },
  { id: 'sac', city: 'Sacramento', name: 'Rush', abbr: 'SAC', conference: 'Ouest', division: 'Pacifique', colors: { primary: '#7e22ce', secondary: '#d1d5db' } },
  { id: 'phx', city: 'Phoenix', name: 'Blaze', abbr: 'PHX', conference: 'Ouest', division: 'Pacifique', colors: { primary: '#ea580c', secondary: '#7c2d12' } },
  { id: 'sdg', city: 'San Diego', name: 'Surf', abbr: 'SDG', conference: 'Ouest', division: 'Pacifique', colors: { primary: '#0891b2', secondary: '#fef3c7' } },

  { id: 'dal', city: 'Dallas', name: 'Outlaws', abbr: 'DAL', conference: 'Ouest', division: 'Sud-Ouest', colors: { primary: '#1e40af', secondary: '#94a3b8' } },
  { id: 'hou', city: 'Houston', name: 'Drillers', abbr: 'HOU', conference: 'Ouest', division: 'Sud-Ouest', colors: { primary: '#b91c1c', secondary: '#f8fafc' } },
  { id: 'sas', city: 'San Antonio', name: 'Missions', abbr: 'SAS', conference: 'Ouest', division: 'Sud-Ouest', colors: { primary: '#334155', secondary: '#f1f5f9' } },
  { id: 'nol', city: 'Nouvelle-Orléans', name: 'Krewe', abbr: 'NOL', conference: 'Ouest', division: 'Sud-Ouest', colors: { primary: '#065f46', secondary: '#a855f7' } },
  { id: 'mem', city: 'Memphis', name: 'Grind', abbr: 'MEM', conference: 'Ouest', division: 'Sud-Ouest', colors: { primary: '#1e3a8a', secondary: '#38bdf8' } },
];
