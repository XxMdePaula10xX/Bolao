/**
 * SERVIÇO DE CHANCES DE TÍTULO (Monte Carlo).
 *
 * Monta o histórico de pontos por jogo finalizado de cada participante, conta
 * os jogos restantes e roda a simulação pura `simulateTitleChances`.
 */
import { listEditionMembers } from '@/services/editions';
import { loadScoreData } from '@/services/league';
import { scorePrediction } from '@/lib/scoring';
import {
  simulateTitleChances,
  type MonteCarloPlayer,
} from '@/lib/montecarlo';
import type { Match } from '@/types';

/** Um jogo pontua quando está finalizado e com placar definido. */
function isScorable(m: Match): boolean {
  return m.status === 'finished' && m.homeScore !== null && m.awayScore !== null;
}

/**
 * Estima P(terminar em 1º no Ranking Geral) para cada membro.
 * Retorna a lista ordenada por probabilidade decrescente.
 */
export async function getTitleChances(
  editionId: string,
  iterations = 2000,
): Promise<{ userId: string; nickname: string; prob: number }[]> {
  const [members, data] = await Promise.all([
    listEditionMembers(editionId),
    loadScoreData(editionId),
  ]);

  const matches: Match[] = data.orderedMatchIds
    .map((id) => data.matchesById[id])
    .filter((m): m is Match => m != null);

  const finished = matches.filter(isScorable);
  const remaining = matches.filter((m) => m.status !== 'finished').length;

  const players: MonteCarloPlayer[] = members.map((member) => {
    const preds = data.predsByUser[member.userId] ?? {};
    const history: number[] = finished.map((match) => {
      const pred = preds[match.id];
      if (!pred) return 0;
      return scorePrediction(
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
      ).points;
    });
    return {
      userId: member.userId,
      currentPoints: member.totalPoints,
      history,
    };
  });

  const probs = simulateTitleChances({ players, remaining, iterations });

  const nickById = new Map(members.map((m) => [m.userId, m.nickname]));

  return members
    .map((m) => ({
      userId: m.userId,
      nickname: nickById.get(m.userId) ?? '',
      prob: probs[m.userId] ?? 0,
    }))
    .sort((a, b) => b.prob - a.prob);
}
