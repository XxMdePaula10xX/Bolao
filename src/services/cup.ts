import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import {
  buildBracket,
  distributeGroups,
  rankGroupByPoints,
  resolveKnockout,
  roundRobinRounds,
  shuffle,
  splitIntoBlocks,
} from '@/lib/competition';
import {
  decorateSlots,
  fetchNicknames,
  leaguePositions,
  loadScoreData,
  sumPoints,
} from '@/services/league';
import type { EditionScoreData } from '@/services/league';
import type { BracketDoc, KORound } from '@/types';

function cupId(editionId: string): string {
  return `${editionId}_cup`;
}

/** Lê o bracket da Copa (type 'cup'). */
export async function getCup(editionId: string): Promise<BracketDoc | null> {
  const snap = await getDoc(doc(db, 'brackets', cupId(editionId)));
  return snap.exists() ? (snap.data() as BracketDoc) : null;
}

/**
 * Sorteia a Copa no MODELO DE BLOCOS (opção B — automático). A Copa corre
 * JUNTO com a Liga (mesmos jogos, ordenados por startTime); cada confronto
 * consome um bloco consecutivo de `block` jogos.
 *
 *  - 'knockout': `seedOrder = shuffle(memberIds)`, `rounds = buildBracket(seedOrder)`
 *    (mata-mata entre todos). Grava `block`.
 *  - 'groups': `groups = distributeGroups(shuffle(memberIds), groupSize)`. O
 *    mata-mata é sorteado depois (via `drawCupKnockout`), então grava
 *    `koDrawn = false` e `rounds = []`.
 */
export async function drawCup(
  editionId: string,
  memberIds: string[],
  config: { format: 'knockout' | 'groups'; groupSize?: number; qualifiersPerGroup?: number },
  block: number,
  nicknames: Record<string, string>,
): Promise<void> {
  const base = {
    id: cupId(editionId),
    editionId,
    type: 'cup' as const,
    format: config.format,
    block,
  };

  let payload: Record<string, unknown>;
  if (config.format === 'groups') {
    const groupSize = config.groupSize ?? memberIds.length;
    const groups = distributeGroups(shuffle(memberIds), groupSize);
    payload = {
      ...base,
      groups,
      qualifiersPerGroup: config.qualifiersPerGroup ?? 1,
      koDrawn: false,
      rounds: [],
    };
  } else {
    const seedOrder = shuffle(memberIds);
    const rounds = decorateSlots(buildBracket(seedOrder), nicknames);
    payload = { ...base, seedOrder, rounds };
  }

  await setDoc(doc(db, 'brackets', cupId(editionId)), {
    ...payload,
    createdAt: serverTimestamp(),
  });
}

/**
 * Sorteia o mata-mata da Copa em formato 'groups', APÓS a fase de grupos
 * terminar. Ranqueia cada grupo pela soma de pontos nos blocos da fase de
 * grupos (`rankGroupByPoints`, desempate por posição na Liga), pega os
 * `qualifiersPerGroup` melhores de cada grupo, sorteia o mata-mata entre TODOS
 * os classificados (`koSeedOrder = shuffle(classificados)`), monta o bracket e
 * grava `koDrawn = true`.
 *
 * Lança erro se a fase de grupos ainda não terminou.
 */
export async function drawCupKnockout(editionId: string): Promise<void> {
  const cup = await getCup(editionId);
  if (!cup || cup.format !== 'groups' || !cup.groups) {
    throw new Error('Copa não está em formato de grupos.');
  }

  const [data, positions, nicknames] = await Promise.all([
    loadScoreData(editionId),
    leaguePositions(editionId),
    fetchNicknames(editionId),
  ]);

  const block = cup.block ?? 0;
  const groupSize = Math.max(...cup.groups.map((g) => g.memberIds.length));
  const groupPhaseRounds = roundRobinRounds(groupSize);
  const blocks = splitIntoBlocks(data.orderedMatchIds, block);
  const phaseBlocks = blocks.slice(0, groupPhaseRounds);

  // Só pode sortear quando TODOS os blocos da fase de grupos terminaram.
  const complete =
    groupPhaseRounds > 0 &&
    phaseBlocks.length === groupPhaseRounds &&
    phaseBlocks.every((b) => blockFinished(data, b));
  if (!complete) {
    throw new Error('A fase de grupos ainda não terminou.');
  }

  const phaseMatchIds = phaseBlocks.flat();
  const per = cup.qualifiersPerGroup ?? 1;

  const qualified: string[] = [];
  for (const g of cup.groups) {
    const points: Record<string, number> = {};
    for (const id of g.memberIds) points[id] = sumPoints(data, id, phaseMatchIds);
    const ranked = rankGroupByPoints(g.memberIds, points, positions);
    qualified.push(...ranked.slice(0, per));
  }

  const koSeedOrder = shuffle(qualified);
  const rounds = decorateSlots(buildBracket(koSeedOrder), nicknames);

  await setDoc(
    doc(db, 'brackets', cupId(editionId)),
    {
      koSeedOrder,
      koDrawn: true,
      rounds,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

interface CupGroupStanding {
  userId: string;
  nickname: string;
  points: number;
  position: number;
  qualified: boolean;
}

export interface CupLive {
  format: 'knockout' | 'groups';
  block: number;
  groups?: { name: string; standings: CupGroupStanding[] }[];
  groupPhaseComplete: boolean;
  koDrawn: boolean;
  koRounds: KORound[];
  championIds: string[];
}

/**
 * Estado AO VIVO da Copa a partir do BracketDoc + jogos + palpites.
 *
 * Divide os jogos (ordenados por startTime) em blocos de `block`. Um bloco só
 * "conta" quando TODOS os seus jogos estão 'finished'.
 *
 *  - 'knockout': `roundPoints[r]` = pontos de cada participante no bloco `r`
 *    (null se o bloco não terminou); resolve com `resolveKnockout`.
 *  - 'groups': a fase de grupos ocupa os blocos `0..roundRobinRounds(groupSize)-1`;
 *    a classificação de cada grupo é a soma nesses blocos (`rankGroupByPoints`).
 *    `groupPhaseComplete` quando todos esses blocos terminaram. Se `koDrawn`, o
 *    mata-mata usa os blocos a partir de `roundRobinRounds(groupSize)`.
 */
export async function computeCupLive(editionId: string): Promise<CupLive> {
  const cup = await getCup(editionId);
  const block = cup?.block ?? 0;

  if (!cup) {
    return {
      format: 'knockout',
      block: 0,
      groupPhaseComplete: false,
      koDrawn: false,
      koRounds: [],
      championIds: [],
    };
  }

  const [data, positions, nicknames] = await Promise.all([
    loadScoreData(editionId),
    leaguePositions(editionId),
    fetchNicknames(editionId),
  ]);

  const blocks = splitIntoBlocks(data.orderedMatchIds, block);

  // -------------------------------------------------------------- knockout
  if (cup.format !== 'groups') {
    const ids = cup.seedOrder ?? [];
    const roundPoints = cup.rounds.map((_, r) => pointsForBlock(data, ids, blocks[r]));
    const { rounds, championIds } = resolveKnockout(cup.rounds, roundPoints, positions);
    return {
      format: 'knockout',
      block,
      groupPhaseComplete: true,
      koDrawn: true,
      koRounds: decorateSlots(rounds, nicknames),
      championIds,
    };
  }

  // ---------------------------------------------------------------- groups
  const groupsSrc = cup.groups ?? [];
  const groupSize = groupsSrc.length ? Math.max(...groupsSrc.map((g) => g.memberIds.length)) : 0;
  const groupPhaseRounds = roundRobinRounds(groupSize);
  const phaseBlocks = blocks.slice(0, groupPhaseRounds);
  const phaseMatchIds = phaseBlocks.flat();

  const groupPhaseComplete =
    groupPhaseRounds > 0 &&
    phaseBlocks.length === groupPhaseRounds &&
    phaseBlocks.every((b) => blockFinished(data, b));

  const per = cup.qualifiersPerGroup ?? 1;
  const groups = groupsSrc.map((g) => {
    const points: Record<string, number> = {};
    for (const id of g.memberIds) points[id] = sumPoints(data, id, phaseMatchIds);
    const ranked = rankGroupByPoints(g.memberIds, points, positions);
    const standings: CupGroupStanding[] = ranked.map((userId, idx) => ({
      userId,
      nickname: nicknames[userId] ?? userId,
      points: points[userId] ?? 0,
      position: idx + 1,
      qualified: idx < per,
    }));
    return { name: g.name, standings };
  });

  const koDrawn = cup.koDrawn ?? false;
  let koRounds: KORound[] = [];
  let championIds: string[] = [];

  if (koDrawn && cup.rounds.length > 0) {
    // O mata-mata usa os blocos a partir do fim da fase de grupos.
    const roundPoints = cup.rounds.map((_, r) =>
      pointsForBlock(data, cup.koSeedOrder ?? [], blocks[groupPhaseRounds + r]),
    );
    const resolved = resolveKnockout(cup.rounds, roundPoints, positions);
    koRounds = decorateSlots(resolved.rounds, nicknames);
    championIds = resolved.championIds;
  }

  return {
    format: 'groups',
    block,
    groups,
    groupPhaseComplete,
    koDrawn,
    koRounds,
    championIds,
  };
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/** Um bloco só conta quando existe, não está vazio e TODOS os jogos terminaram. */
function blockFinished(data: EditionScoreData, block: string[] | undefined): boolean {
  return (
    !!block &&
    block.length > 0 &&
    block.every((mid) => data.matchesById[mid]?.status === 'finished')
  );
}

/**
 * Pontos de cada `id` no bloco. Retorna `null` (rodada "a definir") quando o
 * bloco ainda não terminou — assim `resolveKnockout` para nessa rodada.
 */
function pointsForBlock(
  data: EditionScoreData,
  ids: string[],
  block: string[] | undefined,
): Record<string, number> | null {
  if (!blockFinished(data, block)) return null;
  const out: Record<string, number> = {};
  for (const id of ids) out[id] = sumPoints(data, id, block as string[]);
  return out;
}
