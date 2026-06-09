import {
  collection,
  doc,
  setDoc,
  serverTimestamp,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from './config';
import { Competition, Match } from '@/types';
import { slugify } from '@/lib/utils';
import { fetchLeagueFixtures } from '../thesportsdb';
import { fetchFootballDataCompetition } from '../footballData';
import { LeagueImport } from '../sportsTypes';

/**
 * Funções do painel de admin. As escritas em competitions/matches só
 * passam se o usuário tiver isSystemAdmin == true (ver firestore.rules).
 */

/** Cria uma competição "na mão" (sem fonte externa). */
export async function createManualCompetition(
  name: string,
  season: string
): Promise<Competition> {
  const ref = doc(collection(db, 'competitions'));
  const comp: Competition = {
    id: ref.id,
    sportType: 'football',
    name: name.trim(),
    season: season.trim(),
    status: 'ongoing',
    sourceProvider: 'manual',
    logoUrl: null,
    metadata: {},
  };
  await setDoc(ref, comp);
  return comp;
}

/** Adiciona um jogo manualmente a uma competição. */
export async function addManualMatch(
  competitionId: string,
  input: { homeName: string; awayName: string; date: Date; round?: number | null }
): Promise<void> {
  const ref = doc(collection(db, 'matches'));
  const match: Match = {
    id: ref.id,
    competitionId,
    externalId: ref.id,
    homeTeam: { id: slugify(input.homeName) || 'home', name: input.homeName.trim(), shortName: '', crestUrl: null },
    awayTeam: { id: slugify(input.awayName) || 'away', name: input.awayName.trim(), shortName: '', crestUrl: null },
    startTime: Timestamp.fromDate(input.date),
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
    round: input.round ?? undefined,
    group: null,
    lastSyncedAt: serverTimestamp() as never,
  };
  await setDoc(ref, match);
}

/** Atualiza o placar/status de um jogo manualmente (para encerrar e pontuar). */
export async function setMatchResult(
  matchId: string,
  homeScore: number,
  awayScore: number,
  finished: boolean
): Promise<void> {
  await setDoc(
    doc(db, 'matches', matchId),
    {
      homeScore,
      awayScore,
      status: finished ? 'finished' : 'live',
      lastSyncedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Grava no Firestore uma competição + seus jogos a partir de um import
 * normalizado (qualquer fonte). Reutilizado pelos importadores.
 */
async function writeLeagueImport(
  data: LeagueImport,
  metadata: Record<string, unknown>
): Promise<{ competitionId: string; name: string; matches: number }> {
  const { competitionId } = data;

  await setDoc(
    doc(db, 'competitions', competitionId),
    {
      id: competitionId,
      sportType: 'football',
      name: data.leagueName,
      season: data.season,
      status: 'ongoing',
      sourceProvider: data.provider,
      logoUrl: null,
      metadata,
    },
    { merge: true }
  );

  let written = 0;
  for (let i = 0; i < data.matches.length; i += 400) {
    const chunk = data.matches.slice(i, i + 400);
    const batch = writeBatch(db);
    for (const m of chunk) {
      const id = `${data.provider === 'football-data' ? 'fd' : 'tsdb'}-${m.externalId}`;
      batch.set(
        doc(db, 'matches', id),
        {
          id,
          competitionId,
          externalId: m.externalId,
          homeTeam: m.homeTeam,
          awayTeam: m.awayTeam,
          startTime: m.date ? Timestamp.fromDate(m.date) : null,
          status: m.status,
          homeScore: m.homeScore,
          awayScore: m.awayScore,
          stage: null,
          round: m.round,
          group: null,
          lastSyncedAt: serverTimestamp(),
        },
        { merge: true }
      );
      written++;
    }
    await batch.commit();
  }

  return { competitionId, name: data.leagueName, matches: written };
}

/** Importa uma liga do TheSportsDB (grátis, sem token). */
export async function importLeagueFromTheSportsDB(leagueId: string) {
  const data = await fetchLeagueFixtures(leagueId);
  return writeLeagueImport(data, { leagueId });
}

/** Importa uma competição da football-data.org (temporada completa). */
export async function importFromFootballData(code: string) {
  const data = await fetchFootballDataCompetition(code);
  return writeLeagueImport(data, { code });
}
