/**
 * Testes da simulação de Monte Carlo. Usa um LCG determinístico como `rand`
 * para resultados reprodutíveis.
 *
 * Rode: node --experimental-strip-types --test src/lib/montecarlo.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulateTitleChances } from './montecarlo.ts';

/** Gerador congruente linear (LCG) — determinístico, retorna [0,1). */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

test('probabilidades somam ~1 e histórico melhor tem prob maior', () => {
  const rand = lcg(42);
  const res = simulateTitleChances(
    {
      players: [
        { userId: 'bom', currentPoints: 0, history: [3, 4, 3, 4] },
        { userId: 'ruim', currentPoints: 0, history: [0, 1, 0, 1] },
      ],
      remaining: 6,
      iterations: 5000,
    },
    rand,
  );

  const soma = res['bom'] + res['ruim'];
  assert.ok(Math.abs(soma - 1) < 1e-9, `soma deveria ser ~1, foi ${soma}`);
  assert.ok(res['bom'] > res['ruim'], `bom (${res['bom']}) deveria superar ruim (${res['ruim']})`);
  assert.ok(res['bom'] > 0.9, `bom deveria dominar, foi ${res['bom']}`);
});

test('vantagem de pontos atuais pesa no resultado', () => {
  const rand = lcg(7);
  const res = simulateTitleChances(
    {
      players: [
        { userId: 'lider', currentPoints: 50, history: [1, 2] },
        { userId: 'atras', currentPoints: 0, history: [1, 2] },
      ],
      remaining: 5,
      iterations: 3000,
    },
    rand,
  );
  // Mesma distribuição de histórico, mas 'lider' tem 50 pontos de vantagem
  // e só restam 5 jogos (máx 10 pontos) → é impossível ser alcançado.
  assert.equal(res['lider'], 1);
  assert.equal(res['atras'], 0);
});

test('histórico vazio usa [0] (não quebra)', () => {
  const rand = lcg(99);
  const res = simulateTitleChances(
    {
      players: [
        { userId: 'zero', currentPoints: 0, history: [] },
        { userId: 'pos', currentPoints: 0, history: [2, 3] },
      ],
      remaining: 4,
      iterations: 1000,
    },
    rand,
  );
  // 'zero' sempre soma 0; 'pos' quase sempre soma >0 → 'pos' ganha todas.
  assert.equal(res['pos'], 1);
  assert.equal(res['zero'], 0);
  assert.ok(Math.abs(res['pos'] + res['zero'] - 1) < 1e-9);
});

test('sem jogadores → objeto vazio', () => {
  const res = simulateTitleChances({ players: [], remaining: 3, iterations: 100 });
  assert.deepEqual(res, {});
});
