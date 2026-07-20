import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { scorePrediction } from '@/lib/scoring';
import { drawRoundRobin, shuffle, splitIntoBlocks, roundRobinRounds, maxBlockSize } from '@/lib/competition';
import { listMatches } from '@/services/matches';
import { getEdition, listEditionMembers } from '@/services/editions';
import type {
  KORound,
  KOSlot,
  LeagueDoc,
  LeagueTableRow,
  Match,
  Prediction,
} from '@/types';

// ---------------------------------------------------------------------------
// Helpers compartilhados pelas competições (Liga, Copa, Consolação)
// ---------------------------------------------------------------------------

/** Dados brutos de uma edição prontos para somar pontos por participante. */
export interface EditionScoreData {
  matchesById: Record<string, Match>;
  orderedMatchIds: string[]; // por startTime asc
  /** userId -> (matchId -> palpite) */
  predsByUser: Record<string, Record<string, Prediction>>;
}

/**
 * Lê TODOS os jogos e palpites da edição de uma vez e monta índices para
 * consultas rápidas de pontuação. Ordena os jogos por startTime (via
 * listMatches).
 */
export async function loadScoreData(editionId: string): Promise<EditionScoreData> {
  const [matches, predsSnap] = await Promise.all([
    listMatches(editionId),
    getDocs(query(collection(db, 'predictions'), where('editionId', '==', editionId))),
  ]);

  const matchesById: Record<string, Match> = {};
  const orderedMatchIds: string[] = [];
  for (const m of matches) {
    matchesById[m.id] = m;
    orderedMatchIds.push(m.id);
  }

  const predsByUser: Record<string, Record<string, Prediction>> = {};
  for (const d of predsSnap.docs) {
    const p = d.data() as Prediction;
    (predsByUser[p.userId] ??= {})[p.matchId] = p;
  }

  return { matchesById, orderedMatchIds, predsByUser };
}

/**
 * Soma os pontos de palpite de um participante no conjunto de jogos indicado.
 * Ignora jogos que não estão 'finished' ou sem placar, e jogos sem palpite.
 */
export function sumPoints(
  data: EditionScoreData,
  userId: string,
  matchIds: string[],
): number {
  const userPreds = data.predsByUser[userId] ?? {};
  let total = 0;
  for (const mid of matchIds) {
    const match = data.matchesById[mid];
    if (!match || match.status !== 'finished') continue;
    if (match.homeScore == null || match.awayScore == null) continue;
    const pred = userPreds[mid];
    if (!pred) continue;
    total += scorePrediction(
      {
        predictedHome: pred.predictedHome,
        predictedAway: pred.predictedAway,
        predictedPenaltyWinner: pred.predictedPenaltyWinner ?? null,
      },
      {
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        isKnockout: match.isKnockout,
        decidedByPenalties: match.decidedByPenalties,
        penaltyWinnerTeamId: match.penaltyWinnerTeamId,
      },
    ).points;
  }
  return total;
}

/** userId -> apelido, a partir dos membros da edição. */
export async function fetchNicknames(editionId: string): Promise<Record<string, string>> {
  const members = await listEditionMembers(editionId);
  const out: Record<string, string> = {};
  for (const m of members) out[m.userId] = m.nickname;
  return out;
}

/**
 * Preenche o apelido em cada slot ocupado de um bracket, sem mutar a entrada.
 * Usado por Copa e Consolação após montar/propagar o chaveamento.
 */
export function decorateSlots(
  rounds: KORound[],
  nicknames: Record<string, string>,
): KORound[] {
  const withNick = (slot: KOSlot): KOSlot =>
    slot ? { userId: slot.userId, nickname: nicknames[slot.userId] ?? slot.nickname } : null;
  return rounds.map((r) => ({
    stage: r.stage,
    matches: r.matches.map((m) => ({
      ...m,
      slotA: withNick(m.slotA),
      slotB: withNick(m.slotB),
    })),
  }));
}

// ---------------------------------------------------------------------------
// Liga
// ---------------------------------------------------------------------------

/** Lê o documento da Liga (id = editionId). */
export async function getLeague(editionId: string): Promise<LeagueDoc | null> {
  const snap = await getDoc(doc(db, 'leagues', editionId));
  return snap.exists() ? (snap.data() as LeagueDoc) : null;
}

/**
 * Sorteia os confrontos da Liga (round-robin embaralhado) e grava o LeagueDoc.
 *
 * REGRA IMPORTANTE (turno único): o nº de rodadas é fixado pelo round-robin
 * (par → n-1, ímpar → n), NÃO por (jogos ÷ bloco). O bloco de jogos por rodada
 * é limitado a ⌊totalGames / rodadas⌋ para os confrontos não quebrarem — se o
 * valor pedido for maior, ele é reduzido para o máximo possível. Os jogos que
 * sobram no fim da competição simplesmente não entram nos confrontos da Liga.
 *
 * Retorna o bloco efetivamente usado (pode ser menor que o pedido).
 */
export async function drawLeague(
  editionId: string,
  memberIds: string[],
  matchesPerRound: number,
  totalGames: number,
): Promise<{ rounds: number; effectiveBlock: number }> {
  const rounds = roundRobinRounds(memberIds.length);
  const maxBlock = maxBlockSize(memberIds.length, totalGames);
  // Trava de segurança: nunca deixa o bloco maior que o máximo viável.
  const effectiveBlock = Math.max(1, Math.min(matchesPerRound, maxBlock || 1));

  const shuffled = shuffle(memberIds);
  const leagueRounds = drawRoundRobin(shuffled, rounds);
  const league: LeagueDoc = {
    id: editionId,
    editionId,
    matchesPerRound: effectiveBlock,
    rounds: leagueRounds,
    createdAt: null,
  };
  await setDoc(doc(db, 'leagues', editionId), {
    ...league,
    createdAt: serverTimestamp(),
  });
  return { rounds, effectiveBlock };
}

interface RoundConfrontoResult {
  aUserId: string;
  bUserId: string | null;
  pointsA: number;
  pointsB: number;
  resolved: boolean;
}

interface Stats {
  userId: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  leaguePoints: number;
  pointsFor: number;
}

/**
 * Calcula a tabela da Liga AO VIVO: divide os jogos (ordenados por startTime)
 * em blocos de matchesPerRound, soma os pontos de cada participante por bloco
 * e resolve os confrontos de cada rodada. Um bloco só conta para a
 * classificação quando TODOS os seus jogos estão 'finished'.
 */
export async function computeLeagueTable(editionId: string): Promise<{
  table: LeagueTableRow[];
  rounds: { round: number; confrontos: RoundConfrontoResult[] }[];
}> {
  const league = await getLeague(editionId);
  if (!league) return { table: [], rounds: [] };
  const data = await loadScoreData(editionId);
  return computeLeagueTableFrom(editionId, data, league);
}

/**
 * Variante de {@link computeLeagueTable} que reaproveita dados já carregados
 * (`data` de {@link loadScoreData} e o `league` já lido). Evita reler TODAS as
 * predictions quando quem chama já tem esses dados em mãos. Comportamento e
 * resultado idênticos a `computeLeagueTable`.
 */
export async function computeLeagueTableFrom(
  editionId: string,
  data: EditionScoreData,
  league: LeagueDoc,
): Promise<{
  table: LeagueTableRow[];
  rounds: { round: number; confrontos: RoundConfrontoResult[] }[];
}> {
  const [edition, nicknames] = await Promise.all([
    getEdition(editionId),
    fetchNicknames(editionId),
  ]);

  const winPoints = edition?.settings?.league.winPoints ?? 3;
  const drawPoints = edition?.settings?.league.drawPoints ?? 1;

  const blocks = splitIntoBlocks(data.orderedMatchIds, league.matchesPerRound);

  // Inicializa stats de todos os participantes que aparecem nos confrontos.
  const stats = new Map<string, Stats>();
  const ensure = (userId: string): Stats => {
    let s = stats.get(userId);
    if (!s) {
      s = {
        userId,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        leaguePoints: 0,
        pointsFor: 0,
      };
      stats.set(userId, s);
    }
    return s;
  };

  const roundsOut: { round: number; confrontos: RoundConfrontoResult[] }[] = [];

  for (let i = 0; i < league.rounds.length; i++) {
    const round = league.rounds[i];
    const block = blocks[i] ?? [];
    const resolved =
      block.length > 0 && block.every((mid) => data.matchesById[mid]?.status === 'finished');

    const confrontos: RoundConfrontoResult[] = [];
    for (const c of round.confrontos) {
      const a = ensure(c.aUserId);
      const pointsA = sumPoints(data, c.aUserId, block);
      if (c.bUserId == null) {
        // Folga (bye): não pontua nem conta como jogo.
        confrontos.push({ aUserId: c.aUserId, bUserId: null, pointsA, pointsB: 0, resolved });
        continue;
      }
      const b = ensure(c.bUserId);
      const pointsB = sumPoints(data, c.bUserId, block);
      confrontos.push({ aUserId: c.aUserId, bUserId: c.bUserId, pointsA, pointsB, resolved });

      if (!resolved) continue;
      a.played++;
      b.played++;
      a.pointsFor += pointsA;
      b.pointsFor += pointsB;
      if (pointsA > pointsB) {
        a.wins++;
        b.losses++;
        a.leaguePoints += winPoints;
      } else if (pointsB > pointsA) {
        b.wins++;
        a.losses++;
        b.leaguePoints += winPoints;
      } else {
        a.draws++;
        b.draws++;
        a.leaguePoints += drawPoints;
        b.leaguePoints += drawPoints;
      }
    }
    roundsOut.push({ round: round.round, confrontos });
  }

  const table: LeagueTableRow[] = [...stats.values()]
    .sort(
      (x, y) =>
        y.leaguePoints - x.leaguePoints ||
        y.pointsFor - x.pointsFor ||
        y.wins - x.wins,
    )
    .map((s, idx) => ({
      userId: s.userId,
      nickname: nicknames[s.userId],
      played: s.played,
      wins: s.wins,
      draws: s.draws,
      losses: s.losses,
      leaguePoints: s.leaguePoints,
      pointsFor: s.pointsFor,
      position: idx + 1,
    }));

  return { table, rounds: roundsOut };
}

/**
 * userId -> posição (1 = melhor) a partir da tabela da Liga. Se ainda não há
 * Liga (ou tabela vazia), usa o Ranking Geral (membros por totalPoints desc).
 */
export async function leaguePositions(editionId: string): Promise<Record<string, number>> {
  const data = await loadScoreData(editionId);
  return leaguePositionsFrom(editionId, data);
}

/**
 * Variante de {@link leaguePositions} que reaproveita dados já carregados.
 * Opcionalmente aceita uma `table` já calculada (de
 * {@link computeLeagueTableFrom}) para evitar recomputá-la. Evita reler as
 * predictions quando quem chama já tem `data`. Resultado idêntico a
 * `leaguePositions`.
 */
export async function leaguePositionsFrom(
  editionId: string,
  data: EditionScoreData,
  table?: LeagueTableRow[],
): Promise<Record<string, number>> {
  let rows = table;
  if (!rows) {
    const league = await getLeague(editionId);
    rows = league ? (await computeLeagueTableFrom(editionId, data, league)).table : [];
  }
  if (rows.length > 0) {
    const out: Record<string, number> = {};
    for (const row of rows) out[row.userId] = row.position;
    return out;
  }
  // Fallback: Ranking Geral (listEditionMembers já vem ordenado por totalPoints desc).
  const members = await listEditionMembers(editionId);
  const out: Record<string, number> = {};
  members.forEach((m, idx) => {
    out[m.userId] = idx + 1;
  });
  return out;
}
