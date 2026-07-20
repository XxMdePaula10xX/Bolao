import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { buildBracket, propagateBracket, resolveConfronto, distributeGroups, shuffle } from '@/lib/competition';
import {
  decorateSlots,
  fetchNicknames,
  leaguePositions,
  loadScoreData,
  sumPoints,
} from '@/services/league';
import type { BracketDoc, KORound } from '@/types';

const BIG_POS = Number.MAX_SAFE_INTEGER;

function cupId(editionId: string): string {
  return `${editionId}_cup`;
}

/** Lê o bracket da Copa (type 'cup'). */
export async function getCup(editionId: string): Promise<BracketDoc | null> {
  const snap = await getDoc(doc(db, 'brackets', cupId(editionId)));
  return snap.exists() ? (snap.data() as BracketDoc) : null;
}

/**
 * Sorteia a Copa.
 *  - 'knockout': embaralha todos e monta o mata-mata direto.
 *  - 'groups': distribui em grupos por sorteio; o mata-mata é definido depois
 *    (via qualifyGroups), então `rounds` começa vazio.
 */
export async function drawCup(
  editionId: string,
  memberIds: string[],
  config: { format: 'knockout' | 'groups'; groupSize?: number; qualifiersPerGroup?: number },
  nicknames: Record<string, string>,
): Promise<void> {
  const base = {
    id: cupId(editionId),
    editionId,
    type: 'cup' as const,
    format: config.format,
  };

  let payload: Record<string, unknown>;
  if (config.format === 'groups') {
    const groups = distributeGroups(memberIds, config.groupSize ?? memberIds.length);
    payload = {
      ...base,
      groups,
      qualifiersPerGroup: config.qualifiersPerGroup ?? 1,
      rounds: [],
    };
  } else {
    const rounds = decorateSlots(buildBracket(shuffle(memberIds)), nicknames);
    payload = { ...base, rounds };
  }

  await setDoc(doc(db, 'brackets', cupId(editionId)), {
    ...payload,
    createdAt: serverTimestamp(),
  });
}

/**
 * Encerra a fase de grupos: ranqueia cada grupo pela soma de pontos nos
 * `groupMatchIds`, pega os `qualifiersPerGroup` melhores de cada grupo, sorteia
 * o mata-mata entre TODOS os classificados e grava as rodadas.
 */
export async function qualifyGroups(editionId: string, groupMatchIds: string[]): Promise<void> {
  const cup = await getCup(editionId);
  if (!cup || !cup.groups) return;

  const [data, positions, nicknames] = await Promise.all([
    loadScoreData(editionId),
    leaguePositions(editionId),
    fetchNicknames(editionId),
  ]);

  const per = cup.qualifiersPerGroup ?? 1;
  const qualified: string[] = [];
  for (const g of cup.groups) {
    const ranked = g.memberIds
      .map((userId) => ({
        userId,
        points: sumPoints(data, userId, groupMatchIds),
        pos: positions[userId] ?? BIG_POS,
      }))
      // mais pontos primeiro; desempate por melhor posição na Liga.
      .sort((a, b) => b.points - a.points || a.pos - b.pos);
    qualified.push(...ranked.slice(0, per).map((r) => r.userId));
  }

  const rounds = decorateSlots(buildBracket(shuffle(qualified)), nicknames);
  await setDoc(
    doc(db, 'brackets', cupId(editionId)),
    { rounds, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/**
 * Resolve uma rodada do mata-mata da Copa: para cada confronto com os dois
 * slots definidos soma os pontos de cada participante em `matchIds`, decide o
 * vencedor (desempate por posição na Liga) e propaga os vencedores. Na FINAL,
 * empate de pontos vira co-campeões (dividem o prêmio).
 */
export async function resolveCupRound(
  editionId: string,
  roundIndex: number,
  matchIds: string[],
): Promise<void> {
  const cup = await getCup(editionId);
  if (!cup || !cup.rounds[roundIndex]) return;

  const [data, positions, nicknames] = await Promise.all([
    loadScoreData(editionId),
    leaguePositions(editionId),
    fetchNicknames(editionId),
  ]);

  // Clona as rodadas para mutação local.
  const rounds: KORound[] = cup.rounds.map((r) => ({
    stage: r.stage,
    matches: r.matches.map((m) => ({ ...m })),
  }));
  const round = rounds[roundIndex];
  const isFinal = roundIndex === rounds.length - 1;

  let championIds: string[] | undefined = cup.championIds;

  for (const m of round.matches) {
    const aId = m.slotA?.userId;
    const bId = m.slotB?.userId;
    if (!aId || !bId) continue; // bye ou slot ainda vazio

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

    if (isFinal) {
      if (pointsEqual) {
        m.coChampions = true;
        championIds = [aId, bId];
      } else {
        championIds = [winnerId];
      }
    }
  }

  const propagated = decorateSlots(propagateBracket(rounds), nicknames);
  await setDoc(
    doc(db, 'brackets', cupId(editionId)),
    {
      rounds: propagated,
      ...(championIds ? { championIds } : {}),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
