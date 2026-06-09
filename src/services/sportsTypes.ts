/** Tipos neutros usados pelos importadores de dados esportivos. */

export interface NormalizedTeam {
  id: string;
  name: string;
  shortName: string;
  crestUrl: string | null;
}

export interface NormalizedMatch {
  externalId: string;
  homeTeam: NormalizedTeam;
  awayTeam: NormalizedTeam;
  date: Date | null;
  status: 'scheduled' | 'live' | 'finished' | 'postponed' | 'canceled';
  homeScore: number | null;
  awayScore: number | null;
  round: number | null;
}

export interface LeagueImport {
  competitionId: string;
  leagueName: string;
  season: string;
  provider: string;
  matches: NormalizedMatch[];
}
