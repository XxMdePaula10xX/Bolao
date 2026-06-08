/**
 * Fonte de dados esportivos GRATUITA e sem token: TheSportsDB.
 *
 * Usa a chave de teste pública ("3"), que não exige cadastro. Como não
 * há segredo a proteger, podemos chamar direto do app (diferente da
 * football-data.org, cuja chave fica no backend).
 *
 * Se um dia a chave de teste parar de funcionar, pegue uma chave grátis
 * em https://www.thesportsdb.com e defina EXPO_PUBLIC_THESPORTSDB_KEY no .env.
 */
const KEY = process.env.EXPO_PUBLIC_THESPORTSDB_KEY || '3';
const BASE = `https://www.thesportsdb.com/api/v1/json/${KEY}`;

/** Ligas populares já com o ID do TheSportsDB (atalhos no painel admin). */
export const POPULAR_LEAGUES: { id: string; name: string }[] = [
  { id: '4351', name: 'Brasileirão Série A' },
  { id: '4352', name: 'Brasileirão Série B' },
  { id: '4328', name: 'Premier League (Inglaterra)' },
  { id: '4335', name: 'La Liga (Espanha)' },
  { id: '4332', name: 'Serie A (Itália)' },
  { id: '4331', name: 'Bundesliga (Alemanha)' },
  { id: '4334', name: 'Ligue 1 (França)' },
  { id: '4480', name: 'Champions League' },
];

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
  leagueId: string;
  leagueName: string;
  season: string;
  matches: NormalizedMatch[];
}

function parseDate(e: any): Date | null {
  const ts: string | undefined = e.strTimestamp;
  if (ts) {
    const iso = ts.includes('T') ? ts : ts.replace(' ', 'T');
    const withZ = /[Z+]/.test(iso) ? iso : `${iso}Z`;
    const d = new Date(withZ);
    if (!isNaN(d.getTime())) return d;
  }
  if (e.dateEvent) {
    const time = e.strTime && e.strTime !== '00:00:00' ? e.strTime : '00:00:00';
    const d = new Date(`${e.dateEvent}T${time}Z`);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function mapStatus(
  raw: string | undefined,
  hs: number | null,
  as: number | null
): NormalizedMatch['status'] {
  const v = (raw || '').toLowerCase();
  if (['1h', '2h', 'ht', 'live', 'in play', 'playing'].some((x) => v.includes(x)))
    return 'live';
  if (v.includes('finished') || v === 'ft' || v.includes('aet') || v.includes('pen'))
    return 'finished';
  if (v.includes('postpon')) return 'postponed';
  if (v.includes('cancel') || v.includes('abandon')) return 'canceled';
  if (hs != null && as != null) return 'finished'; // tem placar final
  return 'scheduled';
}

function num(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function mapEvent(e: any): NormalizedMatch {
  const hs = num(e.intHomeScore);
  const as = num(e.intAwayScore);
  return {
    externalId: String(e.idEvent),
    homeTeam: {
      id: e.idHomeTeam ? String(e.idHomeTeam) : e.strHomeTeam ?? 'home',
      name: e.strHomeTeam ?? 'Mandante',
      shortName: '',
      crestUrl: e.strHomeTeamBadge ?? null,
    },
    awayTeam: {
      id: e.idAwayTeam ? String(e.idAwayTeam) : e.strAwayTeam ?? 'away',
      name: e.strAwayTeam ?? 'Visitante',
      shortName: '',
      crestUrl: e.strAwayTeamBadge ?? null,
    },
    date: parseDate(e),
    status: mapStatus(e.strStatus, hs, as),
    homeScore: hs,
    awayScore: as,
    round: num(e.intRound),
  };
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TheSportsDB respondeu ${res.status}`);
  return res.json();
}

/**
 * Busca os jogos recentes e próximos de uma liga (até ~30 partidas).
 * Usa os endpoints gratuitos eventspastleague + eventsnextleague.
 */
export async function fetchLeagueFixtures(leagueId: string): Promise<LeagueImport> {
  const [past, next] = await Promise.all([
    fetchJson(`${BASE}/eventspastleague.php?id=${leagueId}`).catch(() => ({ events: null })),
    fetchJson(`${BASE}/eventsnextleague.php?id=${leagueId}`).catch(() => ({ events: null })),
  ]);

  const rawEvents = [...(past?.events ?? []), ...(next?.events ?? [])];
  if (rawEvents.length === 0) {
    throw new Error(
      'Nenhum jogo encontrado para essa liga. A liga pode exigir chave premium — ' +
        'tente outra, ou adicione jogos manualmente.'
    );
  }

  // Remove duplicados por idEvent.
  const byId = new Map<string, any>();
  for (const e of rawEvents) byId.set(String(e.idEvent), e);
  const events = Array.from(byId.values());

  const leagueName = events[0]?.strLeague ?? `Liga ${leagueId}`;
  const season = events[0]?.strSeason ?? '';

  return {
    leagueId,
    leagueName,
    season,
    matches: events.map(mapEvent),
  };
}
