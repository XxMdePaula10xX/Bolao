// Cópia do motor de pontuação para uso no backend.
// (As Cloud Functions são um pacote Node separado, por isso o código
//  é duplicado aqui em vez de importado de src/. Mantenha as duas
//  versões em sincronia — a regra é simples e raramente muda.)

export interface ScoringRules {
  exactScorePoints: number;
  winnerPoints: number;
  drawPoints: number;
  qualifiedTeamPoints: number;
}

export interface ScoreInput {
  predictedHome: number;
  predictedAway: number;
  actualHome: number;
  actualAway: number;
}

function sign(n: number): -1 | 0 | 1 {
  if (n > 0) return 1;
  if (n < 0) return -1;
  return 0;
}

export function calculatePoints(input: ScoreInput, rules: ScoringRules): number {
  const { predictedHome, predictedAway, actualHome, actualAway } = input;
  if (predictedHome === actualHome && predictedAway === actualAway) {
    return rules.exactScorePoints;
  }
  const actualResult = sign(actualHome - actualAway);
  const predictedResult = sign(predictedHome - predictedAway);
  if (actualResult === predictedResult) {
    return actualResult === 0 ? rules.drawPoints : rules.winnerPoints;
  }
  return 0;
}

export function isExactHit(input: ScoreInput): boolean {
  return (
    input.predictedHome === input.actualHome &&
    input.predictedAway === input.actualAway
  );
}
