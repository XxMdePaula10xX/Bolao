/**
 * Testes do motor de premiação. Cobre o exemplo REAL do PRD:
 *  - perMarket = 30; Melhor Jogador sem acertador → 30 redistribuído entre os
 *    3 mercados com acertador → cada pote vira 40.
 *  - Campeão com 7 acertadores → 40/7 = 5.71 cada.
 *  - Artilheiro com 12 acertadores → 40/12 = 3.33 cada.
 *  - Copa co-campeões: total 50 → 25 cada.
 *  - Ranking 100/50/20 aos 3 primeiros.
 *
 * Rode: node --experimental-strip-types --test src/lib/prizes.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePayouts } from './prizes.ts';
import type { EditionPrizes } from '../types/index.ts';

const prizes: EditionPrizes = {
  ranking: { first: 100, second: 50, third: 20 },
  league: { first: 60, second: 30, third: 10 },
  cup: { total: 50 },
  longTerm: { perMarket: 30 },
};

function seven(prefix: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);
}

const champWinners = seven('c', 7); // 7 acertadores
const topWinners = seven('t', 12); // 12 acertadores
const assistWinners = ['a1']; // 1 acertador

const result = computePayouts({
  prizes,
  rankingOrder: ['r1', 'r2', 'r3', 'r4'],
  leagueOrder: ['l1', 'l2', 'l3'],
  cupChampionIds: ['cup1', 'cup2'], // co-campeões
  longTermWinners: {
    champion: champWinners,
    topScorer: topWinners,
    assistLeader: assistWinners,
    bestPlayer: [], // sem acertador → redistribui
  },
  contributions: { r1: 10, r2: 10, l1: 10, cup1: 10, c1: 10 },
});

test('Ranking paga 100/50/20 aos 3 primeiros', () => {
  assert.equal(result.byUser['r1'].total, 100);
  assert.equal(result.byUser['r2'].total, 50);
  assert.equal(result.byUser['r3'].total, 20);
  assert.equal(result.byUser['r1'].breakdown[0].source, 'Ranking 1º');
  // 4º do ranking não recebe nada por ranking
  assert.equal(result.byUser['r4'], undefined);
});

test('Liga paga 60/30/10 aos 3 primeiros', () => {
  assert.equal(result.byUser['l1'].total, 60);
  assert.equal(result.byUser['l2'].total, 30);
  assert.equal(result.byUser['l3'].total, 10);
  assert.equal(result.byUser['l1'].breakdown[0].source, 'Liga 1º');
});

test('Copa: co-campeões dividem 50 → 25 cada', () => {
  assert.equal(result.byUser['cup1'].total, 25);
  assert.equal(result.byUser['cup2'].total, 25);
  assert.equal(result.byUser['cup1'].breakdown.some((b) => b.source === 'Copa'), true);
});

test('Longo Prazo: mercado sem acertador redistribui → potes de 40', () => {
  assert.equal(result.perMarketPot['champion'], 40);
  assert.equal(result.perMarketPot['topScorer'], 40);
  assert.equal(result.perMarketPot['assistLeader'], 40);
  assert.equal(result.perMarketPot['bestPlayer'], 0);
});

test('Campeão com 7 acertadores → 40/7 = 5.71 cada', () => {
  for (const uid of champWinners) {
    const row = result.byUser[uid];
    const item = row.breakdown.find((b) => b.source === 'Longo Prazo: Campeão');
    assert.equal(item?.amount, 5.71);
  }
});

test('Artilheiro com 12 acertadores → 40/12 = 3.33 cada', () => {
  for (const uid of topWinners) {
    const item = result.byUser[uid].breakdown.find((b) => b.source === 'Longo Prazo: Artilheiro');
    assert.equal(item?.amount, 3.33);
  }
});

test('Garçom com 1 acertador → pote inteiro (40)', () => {
  const item = result.byUser['a1'].breakdown.find((b) => b.source === 'Longo Prazo: Garçom');
  assert.equal(item?.amount, 40);
});

test('pool = soma das contribuições', () => {
  assert.equal(result.pool, 50); // 10*5
});

test('distributed = soma de tudo o que foi distribuído', () => {
  // Ranking 170 + Liga 100 + Copa 50 + LP (7*5.71 + 12*3.33 + 40) = 439.93
  const lp = round2(7 * 5.71 + 12 * 3.33 + 40);
  assert.equal(result.distributed, round2(170 + 100 + 50 + lp));
  assert.equal(result.distributed, 439.93);
});

test('acumula múltiplas origens no mesmo usuário', () => {
  const res = computePayouts({
    prizes,
    rankingOrder: ['x'],
    leagueOrder: ['x'],
    cupChampionIds: ['x'],
    longTermWinners: { champion: [], topScorer: [], assistLeader: [], bestPlayer: [] },
    contributions: {},
  });
  // x recebe Ranking 1º (100) + Liga 1º (60) + Copa (50) = 210
  assert.equal(res.byUser['x'].total, 210);
  assert.equal(res.byUser['x'].breakdown.length, 3);
});

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
