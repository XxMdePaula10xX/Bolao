import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './config';
import { KnockoutBracket, TournamentType, UserProfile } from '@/types';
import {
  BracketData,
  BracketSlot,
  generateBracket,
  setWinner as setBracketWinner,
} from '@/lib/bracket';
import { listPoolMembers } from './pools';

function bracketDocId(poolId: string, type: TournamentType) {
  return `${poolId}_${type}`;
}

export async function getBracket(
  poolId: string,
  type: TournamentType
): Promise<KnockoutBracket | null> {
  const snap = await getDoc(doc(db, 'knockoutBrackets', bracketDocId(poolId, type)));
  return snap.exists() ? (snap.data() as KnockoutBracket) : null;
}

/**
 * Gera o chaveamento a partir dos membros ativos do bolão.
 * - 'cup': seed pela classificação (mais pontos = melhor seed).
 * - 'losersCup' (copa dos ruins): seed invertido (menos pontos = seed 1).
 * Para `random`, embaralha a ordem.
 */
export async function generateAndSaveBracket(
  pool: { id: string },
  owner: UserProfile,
  type: TournamentType,
  seedSource: 'leagueStanding' | 'random' = 'leagueStanding'
): Promise<KnockoutBracket> {
  const members = await listPoolMembers(pool.id);

  let ordered = [...members];
  if (seedSource === 'random') {
    ordered = shuffle(ordered);
  } else if (type === 'losersCup') {
    // Copa dos ruins: pior colocado vira o "cabeça de chave".
    ordered.sort((a, b) => a.totalPoints - b.totalPoints);
  } else {
    ordered.sort((a, b) => b.totalPoints - a.totalPoints);
  }

  const participants: BracketSlot[] = ordered.map((m) => ({
    userId: m.userId,
    userName: m.userName,
  }));
  const data = generateBracket(participants);

  const bracket: KnockoutBracket = {
    id: bracketDocId(pool.id, type),
    poolId: pool.id,
    tournamentType: type,
    seedSource,
    generatedBy: owner.id,
    generatedAt: serverTimestamp() as never,
    rounds: data.rounds,
  };
  await setDoc(doc(db, 'knockoutBrackets', bracket.id), bracket);
  return bracket;
}

/** Define o vencedor de um confronto e salva o chaveamento atualizado. */
export async function updateBracketWinner(
  bracket: KnockoutBracket,
  roundIndex: number,
  matchId: string,
  winnerId: string
): Promise<BracketData> {
  const current: BracketData = { rounds: bracket.rounds as never };
  const updated = setBracketWinner(current, roundIndex, matchId, winnerId);
  await setDoc(
    doc(db, 'knockoutBrackets', bracket.id),
    { rounds: updated.rounds },
    { merge: true }
  );
  return updated;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
