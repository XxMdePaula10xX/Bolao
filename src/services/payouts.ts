import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { getEdition, listEditionMembers } from '@/services/editions';
import { computeLeagueTable } from '@/services/league';
import { getCup } from '@/services/cup';
import { listLongTerm } from '@/services/longterm';
import { computePayouts } from '@/lib/prizes';
import type {
  EditionMember,
  LongTermGabarito,
  LongTermPrediction,
  PayoutResult,
  PayoutsDoc,
} from '@/types';

/** Gabarito vazio padrão (nenhum mercado definido ainda). */
const EMPTY_GABARITO: LongTermGabarito = {
  championTeam: null,
  topScorer: null,
  assistLeader: null,
  bestPlayer: null,
};

/** Lê o documento de premiação (id = editionId) com contribuições e gabarito. */
export async function getPayouts(editionId: string): Promise<PayoutsDoc | null> {
  const snap = await getDoc(doc(db, 'payouts', editionId));
  return snap.exists() ? (snap.data() as PayoutsDoc) : null;
}

/** Grava (merge) as contribuições de cada participante (userId -> R$). */
export async function saveContributions(
  editionId: string,
  contributions: Record<string, number>,
): Promise<void> {
  await setDoc(
    doc(db, 'payouts', editionId),
    {
      id: editionId,
      editionId,
      contributions,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/** Grava (merge) o gabarito dos 4 mercados de longo prazo (respostas certas). */
export async function saveGabarito(
  editionId: string,
  gabarito: LongTermGabarito,
): Promise<void> {
  await setDoc(
    doc(db, 'payouts', editionId),
    {
      id: editionId,
      editionId,
      gabarito,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/** Um palpite bate o gabarito quando a resposta certa existe e é idêntica. */
function isHit(guess: string | null | undefined, answer: string | null | undefined): boolean {
  if (answer == null || answer === '') return false;
  return guess === answer;
}

/** Reúne quem acertou cada mercado de longo prazo, comparando com o gabarito. */
function collectLongTermWinners(
  predictions: LongTermPrediction[],
  gabarito: LongTermGabarito,
): {
  champion: string[];
  topScorer: string[];
  assistLeader: string[];
  bestPlayer: string[];
} {
  const winners = {
    champion: [] as string[],
    topScorer: [] as string[],
    assistLeader: [] as string[],
    bestPlayer: [] as string[],
  };
  for (const p of predictions) {
    if (isHit(p.championTeam, gabarito.championTeam)) winners.champion.push(p.userId);
    if (isHit(p.topScorer, gabarito.topScorer)) winners.topScorer.push(p.userId);
    if (isHit(p.assistLeader, gabarito.assistLeader)) winners.assistLeader.push(p.userId);
    if (isHit(p.bestPlayer, gabarito.bestPlayer)) winners.bestPlayer.push(p.userId);
  }
  return winners;
}

/**
 * Calcula o rateio da premiação AO VIVO a partir do estado atual da edição:
 *  - Ranking Geral: membros por totalPoints desc (listEditionMembers).
 *  - Liga: ordem da tabela da Liga (computeLeagueTable).
 *  - Copa: championIds do bracket (getCup).
 *  - Longo Prazo: palpites de todos vs. gabarito do PayoutsDoc.
 *  - Contribuições: do PayoutsDoc.
 * Delega o rateio à função pura computePayouts e devolve também os membros
 * (para exibir apelidos na tela).
 */
export async function computePayoutsLive(
  editionId: string,
): Promise<PayoutResult & { members: EditionMember[] }> {
  const [edition, members, leagueTable, cup, longTermPreds, payouts] = await Promise.all([
    getEdition(editionId),
    listEditionMembers(editionId),
    computeLeagueTable(editionId),
    getCup(editionId),
    listLongTerm(editionId),
    getPayouts(editionId),
  ]);

  if (!edition) {
    throw new Error('Edição não encontrada.');
  }

  // Ranking Geral: listEditionMembers já vem ordenado por totalPoints desc.
  const rankingOrder = members.map((m) => m.userId);
  // Liga: tabela já ordenada por position asc.
  const leagueOrder = leagueTable.table.map((row) => row.userId);
  const cupChampionIds = cup?.championIds ?? [];

  const gabarito = payouts?.gabarito ?? EMPTY_GABARITO;
  const contributions = payouts?.contributions ?? {};
  const longTermWinners = collectLongTermWinners(longTermPreds, gabarito);

  const result = computePayouts({
    prizes: edition.prizes,
    rankingOrder,
    leagueOrder,
    cupChampionIds,
    longTermWinners,
    contributions,
  });

  // Enriquecer com apelidos (a lógica pura não conhece nomes).
  const nickById = new Map(members.map((m) => [m.userId, m.nickname]));
  for (const u of Object.values(result.byUser)) {
    u.nickname = nickById.get(u.userId) ?? u.nickname;
  }

  return { ...result, members };
}
