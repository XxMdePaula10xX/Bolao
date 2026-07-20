/**
 * CHANCES DE TÍTULO — simulação de Monte Carlo (PRD).
 *
 * Estima P(terminar em 1º no Ranking Geral) para cada participante, simulando
 * os jogos restantes por BOOTSTRAP: em cada iteração, para cada jogador,
 * amostramos `remaining` pontuações do seu histórico (com reposição) e somamos
 * aos pontos atuais. Quem tiver o maior total naquela iteração "ganha".
 *
 * Função PURA: aceita `rand` (padrão Math.random) para testes determinísticos.
 */

export interface MonteCarloPlayer {
  userId: string;
  currentPoints: number;
  history: number[]; // pontuações passadas (por jogo) para amostrar
}

export interface SimulateTitleChancesInput {
  players: MonteCarloPlayer[];
  remaining: number;
  iterations: number;
}

/**
 * Retorna userId → probabilidade (0..1) de terminar em 1º. A soma das
 * probabilidades é ~1 (cada iteração premia exatamente um vencedor).
 */
export function simulateTitleChances(
  input: SimulateTitleChancesInput,
  rand: () => number = Math.random,
): Record<string, number> {
  const { players, remaining, iterations } = input;

  const wins: Record<string, number> = {};
  for (const p of players) wins[p.userId] = 0;

  if (players.length === 0 || iterations <= 0) {
    return wins;
  }

  // Pré-calcula histórico usável (vazio → [0]).
  const samples = players.map((p) => (p.history.length > 0 ? p.history : [0]));

  for (let it = 0; it < iterations; it++) {
    let bestIdx = 0;
    let bestTotal = -Infinity;
    for (let i = 0; i < players.length; i++) {
      const hist = samples[i];
      let total = players[i].currentPoints;
      for (let r = 0; r < remaining; r++) {
        total += hist[Math.floor(rand() * hist.length)];
      }
      if (total > bestTotal) {
        bestTotal = total;
        bestIdx = i;
      }
    }
    wins[players[bestIdx].userId]++;
  }

  const out: Record<string, number> = {};
  for (const p of players) out[p.userId] = wins[p.userId] / iterations;
  return out;
}
