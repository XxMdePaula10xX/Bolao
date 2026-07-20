import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import {
  buildConsolationRounds,
  consolationBlockInfo,
  resolveKnockout,
  splitIntoBlocks,
} from '@/lib/competition';
import {
  computeLeagueTable,
  decorateSlots,
  fetchNicknames,
  getLeague,
  leaguePositions,
  loadScoreData,
  sumPoints,
} from '@/services/league';
import type { BracketDoc, KORound } from '@/types';

function consolationId(editionId: string): string {
  return `${editionId}_consolation`;
}

/** Lê o bracket da Consolação (type 'consolation'). */
export async function getConsolation(editionId: string): Promise<BracketDoc | null> {
  const snap = await getDoc(doc(db, 'brackets', consolationId(editionId)));
  return snap.exists() ? (snap.data() as BracketDoc) : null;
}

/**
 * Monta a Consolação (segunda chance) por BLOCOS automáticos. Pega os `lastN`
 * ÚLTIMOS da tabela da Liga (do melhor-dos-últimos ao pior), semeia melhor x
 * pior e monta o bracket. A janela de jogos da Consolação começa DEPOIS da Liga
 * (em `ligaGamesUsed`); se a Liga consumiu jogos demais, a janela sobrepõe o
 * fim da competição — nesse caso usa os últimos (rodadas × bloco) jogos.
 *
 * `block` é o bloco de jogos por confronto (travado em maxBlock pela UI).
 */
export async function drawConsolation(
  editionId: string,
  lastN: number,
  block: number,
  nicknames: Record<string, string>,
): Promise<void> {
  const [{ table }, data, league] = await Promise.all([
    computeLeagueTable(editionId),
    loadScoreData(editionId),
    getLeague(editionId),
  ]);

  // Últimos da tabela, do melhor-dos-últimos ao pior (a tabela já vem ordenada
  // do melhor ao pior no geral).
  const lastRows = lastN > 0 ? table.slice(-lastN) : [];
  const seedOrder = lastRows.map((r) => r.userId);
  const rounds = decorateSlots(buildConsolationRounds(seedOrder), nicknames);

  const totalGames = data.orderedMatchIds.length;
  const ligaGamesUsed = league ? league.rounds.length * league.matchesPerRound : 0;

  const consolationRounds = rounds.length;
  const info = consolationBlockInfo(consolationRounds, totalGames, ligaGamesUsed);
  const overlapsLiga = info.overlaps;
  const startGameIndex = overlapsLiga
    ? Math.max(0, totalGames - consolationRounds * block)
    : ligaGamesUsed;

  const bracket: BracketDoc = {
    id: consolationId(editionId),
    editionId,
    type: 'consolation',
    rounds,
    seedOrder,
    block,
    startGameIndex,
    overlapsLiga,
    createdAt: null,
  };
  await setDoc(doc(db, 'brackets', consolationId(editionId)), {
    ...bracket,
    createdAt: serverTimestamp(),
  });
}

/**
 * Resolve a Consolação AO VIVO. A janela de jogos começa em `startGameIndex`;
 * dividimos essa janela em blocos de `block` jogos. Cada rodada do mata-mata usa
 * o bloco correspondente (só "conta" quando todos os jogos do bloco terminaram).
 * O desempate de confronto é pela posição na Liga; a final empatada vira
 * co-campeonato (via resolveKnockout).
 */
export async function computeConsolationLive(editionId: string): Promise<{
  block: number;
  koRounds: KORound[];
  championIds: string[];
  startGameIndex: number;
  overlapsLiga: boolean;
}> {
  const bracket = await getConsolation(editionId);
  if (!bracket) {
    return { block: 0, koRounds: [], championIds: [], startGameIndex: 0, overlapsLiga: false };
  }

  const [data, positions, nicknames] = await Promise.all([
    loadScoreData(editionId),
    leaguePositions(editionId),
    fetchNicknames(editionId),
  ]);

  const block = bracket.block ?? 0;
  const startGameIndex = bracket.startGameIndex ?? 0;
  const overlapsLiga = bracket.overlapsLiga ?? false;

  const window = data.orderedMatchIds.slice(startGameIndex);
  const blocks = splitIntoBlocks(window, block);

  // Participantes: os semeados + qualquer um presente nos slots do bracket.
  const participants = new Set<string>(bracket.seedOrder ?? []);
  for (const round of bracket.rounds) {
    for (const m of round.matches) {
      if (m.slotA) participants.add(m.slotA.userId);
      if (m.slotB) participants.add(m.slotB.userId);
    }
  }

  // Pontos por rodada: null enquanto o bloco não terminou por completo.
  const roundPoints = bracket.rounds.map((_round, r) => {
    const blk = blocks[r];
    const done =
      !!blk && blk.length > 0 && blk.every((mid) => data.matchesById[mid]?.status === 'finished');
    if (!done) return null;
    const rec: Record<string, number> = {};
    for (const uid of participants) rec[uid] = sumPoints(data, uid, blk);
    return rec;
  });

  const { rounds, championIds } = resolveKnockout(bracket.rounds, roundPoints, positions);

  return {
    block,
    koRounds: decorateSlots(rounds, nicknames),
    championIds,
    startGameIndex,
    overlapsLiga,
  };
}
