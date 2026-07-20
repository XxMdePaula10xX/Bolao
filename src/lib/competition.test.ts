/**
 * Testes do motor das competições internas (Liga, Copa, Consolação).
 * Rodar com:
 *   node --experimental-strip-types --test src/lib/competition.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  shuffle,
  splitIntoBlocks,
  drawRoundRobin,
  buildBracket,
  propagateBracket,
  resolveConfronto,
  distributeGroups,
  seedConsolation,
  buildConsolationRounds,
  stageName,
  roundRobinRounds,
  maxBlockSize,
  knockoutRounds,
  cupRoundCount,
  maxCupBlock,
  consolationBlockInfo,
} from './competition.ts';

// Gerador determinístico (LCG) para testar sorteios sem depender de Math.random.
function seededRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// ---------------------------------------------------------------------------
// shuffle
// ---------------------------------------------------------------------------
test('shuffle: não muta a original e preserva os elementos', () => {
  const src = ['a', 'b', 'c', 'd', 'e'];
  const copy = src.slice();
  const out = shuffle(src, seededRand(42));
  assert.deepEqual(src, copy, 'original não pode mudar');
  assert.equal(out.length, src.length);
  assert.deepEqual([...out].sort(), [...src].sort(), 'mesmos elementos');
});

test('shuffle: determinístico com o mesmo rand', () => {
  const src = ['a', 'b', 'c', 'd', 'e', 'f'];
  const one = shuffle(src, seededRand(7));
  const two = shuffle(src, seededRand(7));
  assert.deepEqual(one, two);
});

// ---------------------------------------------------------------------------
// splitIntoBlocks
// ---------------------------------------------------------------------------
test('splitIntoBlocks: blocos exatos', () => {
  assert.deepEqual(splitIntoBlocks(['1', '2', '3', '4'], 2), [
    ['1', '2'],
    ['3', '4'],
  ]);
});

test('splitIntoBlocks: último bloco menor', () => {
  assert.deepEqual(splitIntoBlocks(['1', '2', '3', '4', '5'], 2), [
    ['1', '2'],
    ['3', '4'],
    ['5'],
  ]);
});

test('splitIntoBlocks: lista vazia e size inválido', () => {
  assert.deepEqual(splitIntoBlocks([], 4), []);
  assert.deepEqual(splitIntoBlocks(['1', '2'], 0), [['1', '2']]);
});

// ---------------------------------------------------------------------------
// drawRoundRobin
// ---------------------------------------------------------------------------
test('round-robin (par): todos jogam, sem self, sem bye', () => {
  const players = ['p1', 'p2', 'p3', 'p4'];
  const rounds = drawRoundRobin(players, players.length - 1);
  assert.equal(rounds.length, 3);
  for (const r of rounds) {
    assert.equal(r.confrontos.length, 2, 'n/2 confrontos por rodada');
    const seen = new Set<string>();
    for (const c of r.confrontos) {
      assert.notEqual(c.bUserId, null, 'nº par → sem bye');
      assert.notEqual(c.aUserId, c.bUserId, 'sem auto-confronto');
      assert.ok(!seen.has(c.aUserId) && !seen.has(c.bUserId!), 'cada jogador uma vez por rodada');
      seen.add(c.aUserId);
      seen.add(c.bUserId!);
    }
    assert.equal(seen.size, players.length, 'todos jogam na rodada');
  }
  // Todos os pares distintos aparecem exatamente uma vez em n-1 rodadas.
  const pairs = new Set<string>();
  for (const r of rounds)
    for (const c of r.confrontos) pairs.add([c.aUserId, c.bUserId].sort().join('-'));
  assert.equal(pairs.size, 6, 'C(4,2) = 6 confrontos distintos');
});

test('round-robin (ímpar): cada rodada tem exatamente um bye', () => {
  const players = ['a', 'b', 'c', 'd', 'e'];
  const rounds = drawRoundRobin(players, players.length); // 5 rodadas (n-1 = 4 distintas)
  assert.equal(rounds.length, 5);
  for (const r of rounds) {
    const byes = r.confrontos.filter((c) => c.bUserId === null);
    assert.equal(byes.length, 1, 'ímpar → 1 bye por rodada');
    // Nenhum ID falso de bye aparece como jogador.
    for (const c of r.confrontos) {
      assert.notEqual(c.aUserId, '__bye__');
      assert.notEqual(c.bUserId, '__bye__');
      if (c.bUserId !== null) assert.notEqual(c.aUserId, c.bUserId);
    }
  }
});

test('round-robin: cicla quando rounds > n-1', () => {
  const players = ['a', 'b', 'c', 'd'];
  const rounds = drawRoundRobin(players, 5);
  assert.equal(rounds.length, 5);
  // rodada 4 repete a rodada 1 (mesmo emparelhamento por conjunto).
  const key = (r: (typeof rounds)[number]) =>
    r.confrontos
      .map((c) => [c.aUserId, c.bUserId].sort().join('-'))
      .sort()
      .join('|');
  assert.equal(key(rounds[3]), key(rounds[0]));
});

test('round-robin: números de rodada são 1-based e sequenciais', () => {
  const rounds = drawRoundRobin(['a', 'b', 'c', 'd'], 3);
  assert.deepEqual(rounds.map((r) => r.round), [1, 2, 3]);
});

// ---------------------------------------------------------------------------
// stageName
// ---------------------------------------------------------------------------
test('stageName: nomes por nº de jogos na rodada', () => {
  assert.equal(stageName(1), 'Final');
  assert.equal(stageName(2), 'Semifinal');
  assert.equal(stageName(4), 'Quartas');
  assert.equal(stageName(8), 'Oitavas');
  assert.equal(stageName(16), 'Pré-oitavas');
  assert.equal(stageName(32), 'Fase de 64');
});

// ---------------------------------------------------------------------------
// buildBracket
// ---------------------------------------------------------------------------
test('buildBracket: potência de 2 exata (4 jogadores)', () => {
  const rounds = buildBracket(['s1', 's2', 's3', 's4']);
  assert.equal(rounds.length, 2);
  assert.equal(rounds[0].stage, 'Semifinal');
  assert.equal(rounds[1].stage, 'Final');
  assert.equal(rounds[0].matches.length, 2);
  // Seeding: 1 vs 4 e 2 vs 3.
  const m0 = rounds[0].matches[0];
  const m1 = rounds[0].matches[1];
  assert.deepEqual([m0.slotA?.userId, m0.slotB?.userId], ['s1', 's4']);
  assert.deepEqual([m1.slotA?.userId, m1.slotB?.userId], ['s2', 's3']);
  // Sem byes, sem vencedores ainda; final vazia.
  assert.equal(rounds[1].matches[0].slotA, null);
  assert.equal(rounds[1].matches[0].slotB, null);
});

test('buildBracket: com byes (5 jogadores → bracket de 8)', () => {
  const players = ['s1', 's2', 's3', 's4', 's5'];
  const rounds = buildBracket(players);
  assert.equal(rounds[0].stage, 'Quartas');
  assert.equal(rounds[0].matches.length, 4);
  // 3 byes (8 - 5). Byes têm winnerId preenchido na 1ª fase.
  const byeMatches = rounds[0].matches.filter((m) => m.byeA || m.byeB);
  assert.equal(byeMatches.length, 3);
  for (const m of byeMatches) {
    assert.ok(m.winnerId, 'bye avança com winnerId');
  }
  // Seed 1 pega bye (adversário seed 8 inexistente).
  const seed1Match = rounds[0].matches[0];
  assert.equal(seed1Match.slotA?.userId, 's1');
  assert.equal(seed1Match.byeB, true);
  assert.equal(seed1Match.winnerId, 's1');
  // Após propagação, os vencedores de byes já aparecem na semifinal.
  const semi = rounds[1];
  const placed = semi.matches.flatMap((m) => [m.slotA?.userId, m.slotB?.userId]).filter(Boolean);
  assert.ok(placed.includes('s1'));
});

test('buildBracket: estrutura reduz pela metade a cada fase', () => {
  const players = Array.from({ length: 8 }, (_, i) => `p${i + 1}`);
  const rounds = buildBracket(players);
  assert.deepEqual(
    rounds.map((r) => r.matches.length),
    [4, 2, 1],
  );
  assert.deepEqual(
    rounds.map((r) => r.stage),
    ['Quartas', 'Semifinal', 'Final'],
  );
});

test('buildBracket: 1 jogador = campeão sem jogo', () => {
  const rounds = buildBracket(['solo']);
  assert.equal(rounds.length, 1);
  assert.equal(rounds[0].matches[0].winnerId, 'solo');
});

// ---------------------------------------------------------------------------
// propagateBracket
// ---------------------------------------------------------------------------
test('propagateBracket: coloca vencedores na fase seguinte e não muta a entrada', () => {
  const input: Parameters<typeof propagateBracket>[0] = [
    {
      stage: 'Semifinal',
      matches: [
        { id: 'a', slotA: { userId: 'x' }, slotB: { userId: 'y' }, winnerId: 'x' },
        { id: 'b', slotA: { userId: 'z' }, slotB: { userId: 'w' }, winnerId: 'w' },
      ],
    },
    { stage: 'Final', matches: [{ id: 'f', slotA: null, slotB: null }] },
  ];
  const out = propagateBracket(input);
  // match 0 (par) → slotA da final; match 1 (ímpar) → slotB.
  assert.equal(out[1].matches[0].slotA?.userId, 'x');
  assert.equal(out[1].matches[0].slotB?.userId, 'w');
  // Entrada intacta.
  assert.equal(input[1].matches[0].slotA, null);
  assert.equal(input[1].matches[0].slotB, null);
});

// ---------------------------------------------------------------------------
// resolveConfronto
// ---------------------------------------------------------------------------
test('resolveConfronto: mais pontos vence', () => {
  const r = resolveConfronto(
    { userId: 'a', points: 10, leaguePos: 5 },
    { userId: 'b', points: 7, leaguePos: 1 },
  );
  assert.deepEqual(r, { winnerId: 'a', pointsEqual: false });
});

test('resolveConfronto: empate de pontos → melhor posição na Liga avança', () => {
  const r = resolveConfronto(
    { userId: 'a', points: 8, leaguePos: 6 },
    { userId: 'b', points: 8, leaguePos: 2 },
  );
  assert.equal(r.winnerId, 'b', 'menor leaguePos vence');
  assert.equal(r.pointsEqual, true);
});

test('resolveConfronto: pointsEqual é false quando pontos diferem', () => {
  const r = resolveConfronto(
    { userId: 'a', points: 3, leaguePos: 9 },
    { userId: 'b', points: 4, leaguePos: 9 },
  );
  assert.equal(r.winnerId, 'b');
  assert.equal(r.pointsEqual, false);
});

// ---------------------------------------------------------------------------
// distributeGroups
// ---------------------------------------------------------------------------
test('distributeGroups: contagem de grupos e cobertura de participantes', () => {
  const players = Array.from({ length: 12 }, (_, i) => `p${i + 1}`);
  const groups = distributeGroups(players, 4, seededRand(99));
  assert.equal(groups.length, 3, '12 / 4 = 3 grupos');
  assert.deepEqual(groups.map((g) => g.name), ['Grupo A', 'Grupo B', 'Grupo C']);
  const all = groups.flatMap((g) => g.memberIds);
  assert.equal(all.length, 12, 'todos distribuídos');
  assert.deepEqual([...all].sort(), [...players].sort(), 'sem perder/duplicar ninguém');
  for (const g of groups) assert.equal(g.memberIds.length, 4);
});

test('distributeGroups: último grupo menor quando não divide exato', () => {
  const players = Array.from({ length: 10 }, (_, i) => `p${i + 1}`);
  const groups = distributeGroups(players, 4, seededRand(3));
  assert.equal(groups.length, 3);
  assert.deepEqual(groups.map((g) => g.memberIds.length), [4, 4, 2]);
});

test('distributeGroups: determinístico com o mesmo rand', () => {
  const players = ['a', 'b', 'c', 'd', 'e', 'f'];
  const g1 = distributeGroups(players, 3, seededRand(11));
  const g2 = distributeGroups(players, 3, seededRand(11));
  assert.deepEqual(g1, g2);
});

// ---------------------------------------------------------------------------
// seedConsolation
// ---------------------------------------------------------------------------
test('seedConsolation: pares best x worst (par)', () => {
  // ordenado do MELHOR (menos ruim) ao PIOR.
  const last = ['best', 'b2', 'b3', 'worst'];
  const matches = seedConsolation(last);
  assert.equal(matches.length, 2);
  assert.deepEqual([matches[0].slotA?.userId, matches[0].slotB?.userId], ['best', 'worst']);
  assert.deepEqual([matches[1].slotA?.userId, matches[1].slotB?.userId], ['b2', 'b3']);
  for (const m of matches) assert.ok(!m.byeA && !m.byeB);
});

test('seedConsolation: ímpar → melhor do meio recebe bye', () => {
  const last = ['best', 'mid', 'worst'];
  const matches = seedConsolation(last);
  assert.equal(matches.length, 2);
  assert.deepEqual([matches[0].slotA?.userId, matches[0].slotB?.userId], ['best', 'worst']);
  const bye = matches[1];
  assert.equal(bye.slotA?.userId, 'mid');
  assert.equal(bye.slotB, null);
  assert.equal(bye.byeB, true);
  assert.equal(bye.winnerId, 'mid');
});

test('buildConsolationRounds: monta fases nomeadas a partir dos últimos da Liga', () => {
  const last = ['a', 'b', 'c', 'd']; // best..worst
  const rounds = buildConsolationRounds(last);
  assert.deepEqual(rounds.map((r) => r.stage), ['Semifinal', 'Final']);
  assert.deepEqual([rounds[0].matches[0].slotA?.userId, rounds[0].matches[0].slotB?.userId], ['a', 'd']);
});

// ---------------------------------------------------------------------------
// Nº de rodadas do round-robin e bloco máximo de jogos (casos reais do PRD)
// ---------------------------------------------------------------------------
test('roundRobinRounds: par -> n-1, ímpar -> n', () => {
  assert.equal(roundRobinRounds(8), 7);   // par
  assert.equal(roundRobinRounds(10), 9);  // par
  assert.equal(roundRobinRounds(22), 21); // par
  assert.equal(roundRobinRounds(7), 7);   // ímpar (um folga por rodada)
  assert.equal(roundRobinRounds(1), 0);
  assert.equal(roundRobinRounds(0), 0);
});

test('maxBlockSize: exemplos do usuário', () => {
  // 8 pessoas (7 rodadas), 30 jogos -> ⌊30/7⌋ = 4 (usa 28, sobram 2)
  assert.equal(maxBlockSize(8, 30), 4);
  // 10 pessoas (9 rodadas), 30 jogos -> ⌊30/9⌋ = 3
  assert.equal(maxBlockSize(10, 30), 3);
  // 10 pessoas (9 rodadas), 26 jogos -> ⌊26/9⌋ = 2
  assert.equal(maxBlockSize(10, 26), 2);
  // 22 pessoas (21 rodadas), 64 jogos -> ⌊64/21⌋ = 3
  assert.equal(maxBlockSize(22, 64), 3);
});

test('maxBlockSize: jogos insuficientes -> 0', () => {
  // 8 pessoas -> 7 rodadas; com 5 jogos não dá nem 1 por rodada
  assert.equal(maxBlockSize(8, 5), 0);
});

test('rodadas × bloco máximo nunca excede o total de jogos', () => {
  for (const [n, g] of [[8, 30], [10, 30], [10, 26], [22, 64], [16, 48]] as [number, number][]) {
    const b = maxBlockSize(n, g);
    assert.ok(roundRobinRounds(n) * b <= g, `n=${n} g=${g} b=${b}`);
    // e o próximo bloco (b+1) já estouraria
    if (b >= 1) assert.ok(roundRobinRounds(n) * (b + 1) > g);
  }
});

// ---------------------------------------------------------------------------
// Copa e Consolação — nº de confrontos e bloco máximo (casos reais do usuário)
// ---------------------------------------------------------------------------
test('knockoutRounds: rodadas do mata-mata', () => {
  assert.equal(knockoutRounds(16), 4);
  assert.equal(knockoutRounds(8), 3);
  assert.equal(knockoutRounds(5), 3); // bracket de 8
  assert.equal(knockoutRounds(2), 1);
  assert.equal(knockoutRounds(1), 0);
});

test('cupRoundCount: só mata-mata (16 → 4 rodadas) e bloco máx', () => {
  const rounds = cupRoundCount('knockout', 16);
  assert.equal(rounds, 4);
  // 30 jogos, 4 rodadas → bloco máx 7 (7×4 = 28)
  assert.equal(maxCupBlock(rounds, 30), 7);
});

test('cupRoundCount: fase de grupos conta os confrontos do grupo', () => {
  // 16 participantes, grupos de 4, passam 2 → 4 grupos → 8 classificados.
  // grupo (turno de 4) = 3 rodadas + mata-mata (quartas→final) = 3 → 6.
  const rounds = cupRoundCount('groups', 16, 4, 2);
  assert.equal(rounds, 6);
  // 20 jogos, 6 rodadas → bloco máx 3 (6×3 = 18)
  assert.equal(maxCupBlock(rounds, 20), 3);
});

test('consolationBlockInfo: usa a sobra da Liga', () => {
  // 80 jogos, Liga usou 70 → sobram 10; consolação com 2 rodadas → máx 5.
  const info = consolationBlockInfo(2, 80, 70);
  assert.equal(info.leftover, 10);
  assert.equal(info.maxBlock, 5);
  assert.equal(info.overlaps, false);
});

test('consolationBlockInfo: Liga consumiu tudo → sobrepõe o fim', () => {
  // 80 jogos, Liga usou 80 → sem sobra; 3 rodadas → overlaps=true.
  const info = consolationBlockInfo(3, 80, 80);
  assert.equal(info.leftover, 0);
  assert.equal(info.overlaps, true);
  // bloco pequeno (ex.: 2) cabe: 3×2 = 6 jogos no fim.
  assert.ok(info.maxBlock >= 2);
  assert.ok(3 * info.maxBlock <= 80);
});

test('Copa/Consolação: rodadas × bloco máx nunca excede os jogos disponíveis', () => {
  const cupR = cupRoundCount('groups', 16, 4, 2);
  assert.ok(cupR * maxCupBlock(cupR, 20) <= 20);
  const info = consolationBlockInfo(2, 80, 70);
  assert.ok(2 * info.maxBlock <= info.leftover);
});
