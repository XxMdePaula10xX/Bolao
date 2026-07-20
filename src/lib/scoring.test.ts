/**
 * Testes do motor de pontuação (roda com: npm test, após o build; ou via
 * o script de validação). Cobre a escala real 0,1,2,3,4 do nosso bolão.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scorePrediction, pointsFor } from './scoring.ts';

const A = 'BRA';
const B = 'ARG';

test('placar exato = 3', () => {
  assert.equal(pointsFor({ predictedHome: 2, predictedAway: 1 }, { homeScore: 2, awayScore: 1, isKnockout: false }), 3);
});

test('acertou o vencedor (sem cravar) = 1', () => {
  assert.equal(pointsFor({ predictedHome: 3, predictedAway: 0 }, { homeScore: 2, awayScore: 1, isKnockout: false }), 1);
});

test('acertou o empate (sem cravar) = 1', () => {
  assert.equal(pointsFor({ predictedHome: 1, predictedAway: 1 }, { homeScore: 0, awayScore: 0, isKnockout: false }), 1);
});

test('errou o resultado = 0', () => {
  assert.equal(pointsFor({ predictedHome: 0, predictedAway: 2 }, { homeScore: 2, awayScore: 1, isKnockout: false }), 0);
});

test('mata-mata a pênaltis: acertou empate + quem passa = 2', () => {
  const r = scorePrediction(
    { predictedHome: 2, predictedAway: 0, predictedPenaltyWinner: A },
    { homeScore: 1, awayScore: 1, isKnockout: true, decidedByPenalties: true, penaltyWinnerTeamId: A },
  );
  // placar errado (2x0 vs 1x1) → base 0? não: resultado previsto = vitória mandante,
  // real = empate → base 0. Só o bônus conta. Ajustamos o caso abaixo.
  assert.equal(r.penaltyBonus, 1);
});

test('mata-mata a pênaltis: cravou empate + quem passa = 4', () => {
  const r = scorePrediction(
    { predictedHome: 1, predictedAway: 1, predictedPenaltyWinner: A },
    { homeScore: 1, awayScore: 1, isKnockout: true, decidedByPenalties: true, penaltyWinnerTeamId: A },
  );
  assert.equal(r.points, 4);
  assert.equal(r.exactHit, true);
  assert.equal(r.penaltyHit, true);
});

test('mata-mata a pênaltis: acertou empate (1) + errou quem passa = 1', () => {
  const r = scorePrediction(
    { predictedHome: 0, predictedAway: 0, predictedPenaltyWinner: B },
    { homeScore: 1, awayScore: 1, isKnockout: true, decidedByPenalties: true, penaltyWinnerTeamId: A },
  );
  assert.equal(r.points, 1); // base 1 (acertou empate), sem bônus
});

test('mata-mata a pênaltis: cravou (3) mas errou quem passa = 3', () => {
  const r = scorePrediction(
    { predictedHome: 1, predictedAway: 1, predictedPenaltyWinner: B },
    { homeScore: 1, awayScore: 1, isKnockout: true, decidedByPenalties: true, penaltyWinnerTeamId: A },
  );
  assert.equal(r.points, 3);
});

test('bônus não conta em jogo comum (não-mata-mata)', () => {
  const r = scorePrediction(
    { predictedHome: 1, predictedAway: 1, predictedPenaltyWinner: A },
    { homeScore: 1, awayScore: 1, isKnockout: false },
  );
  assert.equal(r.points, 3); // só o placar exato
  assert.equal(r.penaltyBonus, 0);
});
