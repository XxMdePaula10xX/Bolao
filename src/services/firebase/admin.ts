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
 * Importa uma liga do TheSportsDB (grátis, sem token) e grava a
 * competição + jogos no Firestore. Retorna um resumo.
 */
export async function importLeagueFromTheSportsDB(
  leagueId: string
): Promise<{ competitionId: string; name: string; matches: number }> {
  const data = await fetchLeagueFixtures(leagueId);
  const competitionId = `tsdb-${leagueId}`;

  await setDoc(
    doc(db, 'competitions', competitionId),
    {
      id: competitionId,
      sportType: 'football',
      name: data.leagueName,
      season: data.season,
      status: 'ongoing',
      sourceProvider: 'thesportsdb',
      logoUrl: null,
      metadata: { leagueId },
    },
    { merge: true }
  );

  let written = 0;
  for (let i = 0; i < data.matches.length; i += 400) {
    const chunk = data.matches.slice(i, i + 400);
    const batch = writeBatch(db);
    for (const m of chunk) {
      const id = `tsdb-${m.externalId}`;
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
