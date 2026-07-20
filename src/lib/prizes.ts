/**
 * MOTOR DE PREMIAÇÃO — rateio do dinheiro do bolão (PRD).
 *
 * SEM pagamentos/transações: apenas CALCULA quanto cada participante recebe,
 * por origem (Ranking, Liga, Copa, Longo Prazo). Função PURA e determinística.
 *
 * Regras:
 *  - Ranking: prizes.ranking.first/second/third aos 3 primeiros do Ranking Geral.
 *  - Liga: prizes.league.first/second/third aos 3 primeiros da Liga.
 *  - Copa: prizes.cup.total dividido igualmente entre os campeões
 *    (1 → total; 2 co-campeões → metade cada).
 *  - Longo Prazo: base = prizes.longTerm.perMarket por mercado (4 mercados).
 *    Mercados SEM acertador têm seu valor redistribuído igualmente entre os
 *    mercados COM acertador. Vários acertadores de um mercado dividem o pote.
 *
 * Valores monetários arredondados para 2 casas.
 */
import type { EditionPrizes, PayoutResult, UserPayout } from '@/types';

export interface ComputePayoutsInput {
  prizes: EditionPrizes;
  rankingOrder: string[];
  leagueOrder: string[];
  cupChampionIds: string[];
  longTermWinners: {
    champion: string[];
    topScorer: string[];
    assistLeader: string[];
    bestPlayer: string[];
  };
  contributions: Record<string, number>;
}

/** Arredonda para 2 casas decimais (dinheiro). */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

interface Market {
  key: string;
  label: string;
  winners: string[];
}

export function computePayouts(input: ComputePayoutsInput): PayoutResult {
  const { prizes, rankingOrder, leagueOrder, cupChampionIds, longTermWinners, contributions } =
    input;

  const byUser: Record<string, UserPayout> = {};

  function add(userId: string, source: string, amount: number): void {
    const value = round2(amount);
    if (!userId || value <= 0) return;
    let row = byUser[userId];
    if (!row) {
      row = { userId, total: 0, breakdown: [] };
      byUser[userId] = row;
    }
    row.breakdown.push({ source, amount: value });
    row.total = round2(row.total + value);
  }

  // --- Ranking Geral -------------------------------------------------------
  const rankingLabels = ['Ranking 1º', 'Ranking 2º', 'Ranking 3º'];
  const rankingValues = [prizes.ranking.first, prizes.ranking.second, prizes.ranking.third];
  for (let i = 0; i < 3; i++) {
    const uid = rankingOrder[i];
    if (uid) add(uid, rankingLabels[i], rankingValues[i]);
  }

  // --- Liga ----------------------------------------------------------------
  const leagueLabels = ['Liga 1º', 'Liga 2º', 'Liga 3º'];
  const leagueValues = [prizes.league.first, prizes.league.second, prizes.league.third];
  for (let i = 0; i < 3; i++) {
    const uid = leagueOrder[i];
    if (uid) add(uid, leagueLabels[i], leagueValues[i]);
  }

  // --- Copa (co-campeões dividem) ------------------------------------------
  if (cupChampionIds.length > 0 && prizes.cup.total > 0) {
    const share = prizes.cup.total / cupChampionIds.length;
    for (const uid of cupChampionIds) add(uid, 'Copa', share);
  }

  // --- Longo Prazo (redistribui mercados sem acertador) --------------------
  const perMarket = prizes.longTerm.perMarket;
  const markets: Market[] = [
    { key: 'champion', label: 'Longo Prazo: Campeão', winners: longTermWinners.champion },
    { key: 'topScorer', label: 'Longo Prazo: Artilheiro', winners: longTermWinners.topScorer },
    { key: 'assistLeader', label: 'Longo Prazo: Garçom', winners: longTermWinners.assistLeader },
    { key: 'bestPlayer', label: 'Longo Prazo: Melhor Jogador', winners: longTermWinners.bestPlayer },
  ];

  const claimed = markets.filter((m) => m.winners.length > 0);
  const unclaimedTotal = (markets.length - claimed.length) * perMarket;
  const potPerClaimed = claimed.length > 0 ? perMarket + unclaimedTotal / claimed.length : 0;

  const perMarketPot: Record<string, number> = {};
  for (const m of markets) {
    const pot = m.winners.length > 0 ? round2(potPerClaimed) : 0;
    perMarketPot[m.key] = pot;
    if (m.winners.length > 0) {
      const share = potPerClaimed / m.winners.length;
      for (const uid of m.winners) add(uid, m.label, share);
    }
  }

  // --- Totais --------------------------------------------------------------
  let pool = 0;
  for (const v of Object.values(contributions)) pool += v;
  pool = round2(pool);

  let distributed = 0;
  for (const u of Object.values(byUser)) distributed += u.total;
  distributed = round2(distributed);

  return { byUser, pool, distributed, perMarketPot };
}
