/**
 * MOTOR DE PONTUAÇÃO — réplica EXATA de src/lib/scoring.ts.
 *
 * Esta é a FONTE DA VERDADE executada na Cloud Function. O código é uma cópia
 * fiel de src/lib/scoring.ts (o app usa aquela versão apenas para prévia).
 * Mantido sem dependências externas para não importar nada de fora de functions/.
 *
 * Regras FIXAS:
 *  - Placar exato ............................. 3 pontos
 *  - Acertou vencedor/empate (sem cravar) ..... 1 ponto
 *  - Errou o resultado ........................ 0 ponto
 *  - Bônus de mata-mata (só se foi a pênaltis): +1 se acertar a seleção
 *    que se classifica.
 *
 * Escala resultante: 0, 1, 2, 3, 4
 */

export interface PredictionInput {
  predictedHome: number;
  predictedAway: number;
  predictedPenaltyWinner?: string | null;
}

export interface MatchResult {
  homeScore: number;
  awayScore: number;
  isKnockout: boolean;
  decidedByPenalties?: boolean;
  penaltyWinnerTeamId?: string | null;
}

export interface ScoreBreakdown {
  points: number;      // total 0..4
  base: number;        // 0, 1 ou 3 (pelo placar)
  penaltyBonus: number;// 0 ou 1
  exactHit: boolean;   // cravou o placar
  winnerHit: boolean;  // acertou o resultado (base > 0)
  penaltyHit: boolean; // acertou quem passa nos pênaltis
}

function sign(n: number): -1 | 0 | 1 {
  return n > 0 ? 1 : n < 0 ? -1 : 0;
}

/** Calcula os pontos de um palpite contra o resultado real. */
export function scorePrediction(pred: PredictionInput, match: MatchResult): ScoreBreakdown {
  const exactHit =
    pred.predictedHome === match.homeScore && pred.predictedAway === match.awayScore;

  let base = 0;
  if (exactHit) {
    base = 3;
  } else if (sign(pred.predictedHome - pred.predictedAway) === sign(match.homeScore - match.awayScore)) {
    // Mesmo resultado (mandante vence / empate / visitante vence), sem cravar.
    base = 1;
  }

  // Bônus só existe em mata-mata decidido nos pênaltis e com palpite de classificado.
  let penaltyHit = false;
  if (
    match.isKnockout &&
    match.decidedByPenalties &&
    match.penaltyWinnerTeamId &&
    pred.predictedPenaltyWinner &&
    pred.predictedPenaltyWinner === match.penaltyWinnerTeamId
  ) {
    penaltyHit = true;
  }
  const penaltyBonus = penaltyHit ? 1 : 0;

  return {
    points: base + penaltyBonus,
    base,
    penaltyBonus,
    exactHit,
    winnerHit: base > 0,
    penaltyHit,
  };
}

/** Atalho: só o total de pontos. */
export function pointsFor(pred: PredictionInput, match: MatchResult): number {
  return scorePrediction(pred, match).points;
}
