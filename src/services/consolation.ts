import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { buildConsolationRounds, propagateBracket, resolveConfronto } from '@/lib/competition';
import {
  computeLeagueTable,
  decorateSlots,
  fetchNicknames,
  leaguePositions,
  loadScoreData,
  sumPoints,
} from '@/services/league';
import type { BracketDoc, KORound } from '@/types';

const BIG_POS = Number.MAX_SAFE_INTEGER;

function consolationId(editionId: string): string {
  return `${editionId}_consolation`;
}

/** Lê o bracket da Consolação (type 'consolation'). */
export async function getConsolation(editionId: string): Promise<BracketDoc | null> {
  const snap = await getDoc(doc(db, 'brackets', consolationId(editionId)));
  return snap.exists() ? (snap.data() as BracketDoc) : null;
}

/**
 * Monta a Consolação (segunda chance) a partir dos `lastN` ÚLTIMOS da tabela da
 * Liga, semeando melhor-dos-últimos x pior, 2º melhor x 2º pior, etc.
 */
export async function drawConsolation(
  editionId: string,
  lastN: number,
  nicknames: Record<string, string>,
): Promise<void> {
  const { table } = await computeLeagueTable(editionId);
  // Últimos da tabela, na ordem do melhor-dos-últimos ao pior (a tabela já vem
  // ordenada do melhor ao pior no geral).
  const lastRows = lastN > 0 ? table.slice(-lastN) : [];
  const orderedBestToWorst = lastRows.map((r) => r.userId);
  const rounds = decorateSlots(buildConsolationRounds(orderedBestToWorst), nicknames);

  const bracket: BracketDoc = {
    id: consolationId(editionId),
    editionId,
    type: 'consolation',
    rounds,
    createdAt: null,
  };
  await setDoc(doc(db, 'brackets', consolationId(editionId)), {
    ...bracket,
    createdAt: serverTimestamp(),
  });
}

/**
 * Resolve uma rodada do mata-mata da Consolação: soma os pontos de cada
 * participante em `matchIds`, decide o vencedor (desempate por posição na
 * Liga) e propaga. Na final, o empate é desempatado pela posição na Liga (sem
 * co-campeões).
 */
export async function resolveConsolationRound(
  editionId: string,
  roundIndex: number,
  matchIds: string[],
): Promise<void> {
  const bracket = await getConsolation(editionId);
  if (!bracket || !bracket.rounds[roundIndex]) return;

  const [data, positions, nicknames] = await Promise.all([
    loadScoreData(editionId),
    leaguePositions(editionId),
    fetchNicknames(editionId),
  ]);

  const rounds: KORound[] = bracket.rounds.map((r) => ({
    stage: r.stage,
    matches: r.matches.map((m) => ({ ...m })),
  }));
  const round = rounds[roundIndex];
  const isFinal = roundIndex === rounds.length - 1;

  let championIds: string[] | undefined = bracket.championIds;

  for (const m of round.matches) {
    const aId = m.slotA?.userId;
    const bId = m.slotB?.userId;
    if (!aId || !bId) continue;

    const pointsA = sumPoints(data, aId, matchIds);
    const pointsB = sumPoints(data, bId, matchIds);
    const { winnerId, pointsEqual } = resolveConfronto(
      { userId: aId, points: pointsA, leaguePos: positions[aId] ?? BIG_POS },
      { userId: bId, points: pointsB, leaguePos: positions[bId] ?? BIG_POS },
    );

    m.pointsA = pointsA;
    m.pointsB = pointsB;
    m.winnerId = winnerId;
    m.pointsEqual = pointsEqual;
    m.matchIds = matchIds;

    if (isFinal) championIds = [winnerId];
  }

  const propagated = decorateSlots(propagateBracket(rounds), nicknames);
  await setDoc(
    doc(db, 'brackets', consolationId(editionId)),
    {
      rounds: propagated,
      ...(championIds ? { championIds } : {}),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
