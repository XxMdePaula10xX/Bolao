/**
 * Importador da football-data.org para o painel do admin.
 *
 * Diferente do TheSportsDB, a football-data.org exige um token. Para o
 * admin importar direto do app (sem backend), o token fica no .env como
 * EXPO_PUBLIC_FOOTBALL_DATA_TOKEN. É um token GRÁTIS; o risco de expô-lo
 * num app pessoal é baixo. Para produção de verdade, o ideal é usar a
 * Cloud Function `scheduledSyncMatches` (que mantém o token no servidor).
 *
 * Vantagem: traz a TEMPORADA COMPLETA de ~13 competições confiáveis,
 * incluindo Brasileirão (BSA) e Libertadores (CLI).
 */
import { LeagueImport, NormalizedMatch } from './sportsTypes';

const TOKEN = process.env.EXPO_PUBLIC_FOOTBALL_DATA_TOKEN || '';
const BASE = 'https://api.football-data.org/v4';

export function hasFootballDataToken(): boolean {
  return TOKEN.trim().length > 0;
}

/** Competições do plano GRATUITO da football-data.org. */
export const FREE_COMPETITIONS: { code: string; name: string }[] = [
  { code: 'BSA', name: 'Brasileirão Série A' },
  { code: 'CLI', name: 'Copa Libertadores' },
  { code: 'PL', name: 'Premier League (Inglaterra)' },
  { code: 'PD', name: 'La Liga (Espanha)' },
  { code: 'SA', name: 'Serie A (Itália)' },
  { code: 'BL1', name: 'Bundesliga (Alemanha)' },
  { code: 'FL1', name: 'Ligue 1 (França)' },
  { code: 'PPL', name: 'Primeira Liga (Portugal)' },
  { code: 'DED', name: 'Eredivisie (Holanda)' },
  { code: 'ELC', name: 'Championship (Inglaterra)' },
  { code: 'CL', name: 'Champions League' },
  { code: 'EC', name: 'Eurocopa' },
  { code: 'WC', name: 'Copa do Mundo' },
];

function mapStatus(s: string): NormalizedMatch['status'] {
  switch (s) {
    case 'SCHEDULED':
    case 'TIMED':
      return 'scheduled';
    case 'IN_PLAY':
    case 'PAUSED':
      return 'live';
    case 'FINISHED':
    case 'AWARDED':
      return 'finished';
    case 'POSTPONED':
      return 'postponed';
    case 'SUSPENDED':
    case 'CANCELLED':
    case 'CANCELED':
      return 'canceled';
    default:
      return 'scheduled';
  }
}

function mapTeam(t: any) {
  return {
    id: t?.id != null ? String(t.id) : 'tbd',
    name: t?.name ?? 'A definir',
    shortName: t?.tla ?? t?.shortName ?? '',
    crestUrl: t?.crest ?? null,
  };
}

/** Busca a temporada de uma competição (por código, ex.: BSA). */
export async function fetchFootballDataCompetition(code: string): Promise<LeagueImport> {
  if (!TOKEN) {
    throw new Error(
      'Token da football-data.org não configurado. Adicione EXPO_PUBLIC_FOOTBALL_DATA_TOKEN no .env.'
    );
  }
  const res = await fetch(`${BASE}/competitions/${encodeURIComponent(code)}/matches`, {
    headers: { 'X-Auth-Token': TOKEN },
  });
  if (!res.ok) {
    if (res.status === 403) {
      throw new Error('Token inválido ou competição fora do plano grátis.');
    }
    if (res.status === 429) {
      throw new Error('Limite de requisições atingido. Aguarde um minuto e tente de novo.');
    }
    throw new Error(`football-data.org respondeu ${res.status}.`);
  }
  const data: any = await res.json();
  const comp = data.competition ?? {};
  const matches: any[] = data.matches ?? [];
  const firstSeason = matches[0]?.season;
  const season = firstSeason?.startDate ? String(firstSeason.startDate).slice(0, 4) : '';

  if (matches.length === 0) {
    throw new Error('Nenhum jogo retornado para essa competição.');
  }

  const normalized: NormalizedMatch[] = matches.map((m) => ({
    externalId: String(m.id),
    homeTeam: mapTeam(m.homeTeam),
    awayTeam: mapTeam(m.awayTeam),
    date: m.utcDate ? new Date(m.utcDate) : null,
    status: mapStatus(m.status),
    homeScore: m.score?.fullTime?.home ?? null,
    awayScore: m.score?.fullTime?.away ?? null,
    round: m.matchday ?? null,
  }));

  return {
    competitionId: `fd-${code.toLowerCase()}`,
    leagueName: comp.name ?? code,
    season,
    provider: 'football-data',
    matches: normalized,
  };
}
