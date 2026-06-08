import { ScoringRules } from '@/types';

export interface ScoreInput {
  predictedHome: number;
  predictedAway: number;
  actualHome: number;
  actualAway: number;
}

/**
 * Motor de pontuação (RF-06). Recebe o palpite, o placar real e as
 * regras do bolão, e devolve quantos pontos o palpite vale.
 *
 * Esta função é PURA (sem efeitos colaterais), então pode ser usada:
 *  - no app, para mostrar uma prévia da pontuação;
 *  - na Cloud Function, para gravar a pontuação oficial.
 *
 * A versão da Cloud Function é a "fonte da verdade" (seção 24 do PRD).
 */
export function calculatePoints(input: ScoreInput, rules: ScoringRules): number {
  const { predictedHome, predictedAway, actualHome, actualAway } = input;

  const exact = predictedHome === actualHome && predictedAway === actualAway;
  if (exact) return rules.exactScorePoints;

  const actualResult = sign(actualHome - actualAway);
  const predictedResult = sign(predictedHome - predictedAway);

  if (actualResult === predictedResult) {
    // Acertou o resultado (vitória do mandante, empate ou vitória do visitante)
    return actualResult === 0 ? rules.drawPoints : rules.winnerPoints;
  }

  return 0;
}

/** -1 se negativo, 0 se zero, 1 se positivo. */
function sign(n: number): -1 | 0 | 1 {
  if (n > 0) return 1;
  if (n < 0) return -1;
  return 0;
}

export interface ScoreBreakdown {
  points: number;
  exactHit: boolean;
  winnerHit: boolean;
}

/** Versão detalhada, útil para alimentar os rankings de acertos. */
export function scoreBreakdown(input: ScoreInput, rules: ScoringRules): ScoreBreakdown {
  const points = calculatePoints(input, rules);
  const exactHit =
    input.predictedHome === input.actualHome &&
    input.predictedAway === input.actualAway;
  const winnerHit = points > 0;
  return { points, exactHit, winnerHit };
}
