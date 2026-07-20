/**
 * ESTATÍSTICAS DO BOLÃO — prêmios simbólicos e curiosidades (PRD).
 *
 * Função PURA. Reutiliza o motor de pontuação (`scorePrediction`).
 *
 *  - Rei da Cravada .... mais placares exatos (exactHit).
 *  - Bom de Palpite .... mais acertos de vencedor NÃO-exatos (points>0 && !exact).
 *  - Regularidade ...... % de jogos finalizados palpitados em que pontuou.
 *  - Melhor Bloco ...... maior soma de pontos num bloco de `matchesPerRound` jogos.
 *  - Saco de Pontos .... mais pontos-pró somados nos confrontos da Liga (leagueTable).
 *
 * Cada lista é ordenada por `value` decrescente.
 */
import type {
  EditionMember,
  Match,
  Prediction,
  LeagueTableRow,
  StatRow,
} from '@/types';
import { scorePrediction } from '@/lib/scoring';

export interface ComputeStatsInput {
  members: EditionMember[];
  matches: Match[];
  predsByUser: Record<string, Record<string, Prediction>>;
  matchesPerRound: number;
  leagueTable?: LeagueTableRow[];
}

export interface ComputeStatsResult {
  reiCravada: StatRow[];
  bomPalpite: StatRow[];
  regularidade: StatRow[];
  melhorBloco: StatRow[];
  sacoDePontos: StatRow[];
}

/** Um jogo está finalizado e apto a pontuar quando tem placar definido. */
function isScorable(m: Match): boolean {
  return m.status === 'finished' && m.homeScore !== null && m.awayScore !== null;
}

function startMs(m: Match): number {
  const t = m.startTime as unknown;
  if (typeof t === 'number') return t;
  if (t && typeof t === 'object') {
    const o = t as { toMillis?: () => number; seconds?: number };
    if (o.toMillis) return o.toMillis();
    if (o.seconds != null) return o.seconds * 1000;
  }
  return 0;
}

export function computeStats(input: ComputeStatsInput): ComputeStatsResult {
  const { members, matches, predsByUser, matchesPerRound, leagueTable } = input;

  // Ordena por início — os blocos das rodadas são fatiados nessa ordem.
  const ordered = [...matches].sort((a, b) => startMs(a) - startMs(b));
  const scorable = ordered.filter(isScorable);
  const blockSize = matchesPerRound > 0 ? matchesPerRound : scorable.length || 1;

  const leagueByUser = new Map<string, LeagueTableRow>();
  for (const row of leagueTable ?? []) leagueByUser.set(row.userId, row);

  const reiCravada: StatRow[] = [];
  const bomPalpite: StatRow[] = [];
  const regularidade: StatRow[] = [];
  const melhorBloco: StatRow[] = [];
  const sacoDePontos: StatRow[] = [];

  for (const member of members) {
    const uid = member.userId;
    const preds = predsByUser[uid] ?? {};

    let exact = 0;
    let winnerNonExact = 0;
    let predictedCount = 0;
    let scoredCount = 0;

    // Pontos por jogo finalizado, indexados por matchId.
    const ptByMatch: Record<string, number> = {};
    for (const match of scorable) {
      const pred = preds[match.id];
      if (!pred) continue;
      predictedCount++;
      const sb = scorePrediction(
        {
          predictedHome: pred.predictedHome,
          predictedAway: pred.predictedAway,
          predictedPenaltyWinner: pred.predictedPenaltyWinner ?? null,
        },
        {
          homeScore: match.homeScore as number,
          awayScore: match.awayScore as number,
          isKnockout: match.isKnockout,
          decidedByPenalties: match.decidedByPenalties,
          penaltyWinnerTeamId: match.penaltyWinnerTeamId,
        },
      );
      ptByMatch[match.id] = sb.points;
      if (sb.exactHit) exact++;
      if (sb.points > 0) {
        scoredCount++;
        if (!sb.exactHit) winnerNonExact++;
      }
    }

    // Melhor bloco: maior soma num bloco de `blockSize` jogos consecutivos.
    // ALINHADO às rodadas reais: fatiado sobre TODOS os jogos ordenados
    // (0 para jogo não finalizado/sem palpite), não só os finalizados.
    const pointsFullOrder = ordered.map((m) => ptByMatch[m.id] ?? 0);
    let best = 0;
    for (let i = 0; i < pointsFullOrder.length; i += blockSize) {
      let sum = 0;
      for (let j = i; j < i + blockSize && j < pointsFullOrder.length; j++) sum += pointsFullOrder[j];
      if (sum > best) best = sum;
    }

    const regPct = predictedCount > 0 ? (scoredCount / predictedCount) * 100 : 0;
    const saco = leagueByUser.get(uid)?.pointsFor ?? 0;

    reiCravada.push({ userId: uid, nickname: member.nickname, value: exact });
    bomPalpite.push({ userId: uid, nickname: member.nickname, value: winnerNonExact });
    regularidade.push({
      userId: uid,
      nickname: member.nickname,
      value: Math.round(regPct * 10) / 10,
    });
    melhorBloco.push({ userId: uid, nickname: member.nickname, value: best });
    sacoDePontos.push({ userId: uid, nickname: member.nickname, value: saco });
  }

  const byValueDesc = (a: StatRow, b: StatRow): number => b.value - a.value;
  reiCravada.sort(byValueDesc);
  bomPalpite.sort(byValueDesc);
  regularidade.sort(byValueDesc);
  melhorBloco.sort(byValueDesc);
  sacoDePontos.sort(byValueDesc);

  return { reiCravada, bomPalpite, regularidade, melhorBloco, sacoDePontos };
}
