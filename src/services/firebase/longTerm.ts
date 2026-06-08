import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './config';
import { LongTermPrediction, Team, UserProfile } from '@/types';
import { listMatches } from './matches';

/**
 * Lista os times de uma competição. Como ainda não temos uma coleção
 * própria de times, derivamos a lista a partir dos jogos cadastrados
 * (cada jogo traz mandante e visitante).
 */
export async function listCompetitionTeams(competitionId: string): Promise<Team[]> {
  const matches = await listMatches(competitionId);
  const byId = new Map<string, Team>();
  for (const m of matches) {
    if (m.homeTeam) byId.set(m.homeTeam.id, m.homeTeam);
    if (m.awayTeam) byId.set(m.awayTeam.id, m.awayTeam);
  }
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getLongTerm(
  poolId: string,
  userId: string
): Promise<LongTermPrediction | null> {
  const snap = await getDoc(doc(db, 'longTermPredictions', `${poolId}_${userId}`));
  return snap.exists() ? (snap.data() as LongTermPrediction) : null;
}

export interface LongTermInput {
  championTeamId?: string | null;
  championTeamName?: string | null;
  runnerUpTeamId?: string | null;
  runnerUpTeamName?: string | null;
  topScorerName?: string | null;
  bestPlayerName?: string | null;
}

/** Salva (ou atualiza) os palpites de longo prazo do usuário. */
export async function saveLongTerm(
  poolId: string,
  user: UserProfile,
  input: LongTermInput
): Promise<void> {
  const id = `${poolId}_${user.id}`;
  const data: LongTermPrediction = {
    id,
    poolId,
    userId: user.id,
    userName: user.name,
    championTeamId: input.championTeamId ?? null,
    championTeamName: input.championTeamName ?? null,
    runnerUpTeamId: input.runnerUpTeamId ?? null,
    runnerUpTeamName: input.runnerUpTeamName ?? null,
    topScorerName: input.topScorerName ?? null,
    bestPlayerName: input.bestPlayerName ?? null,
    submittedAt: serverTimestamp() as never,
  };
  await setDoc(doc(db, 'longTermPredictions', id), data, { merge: true });
}
