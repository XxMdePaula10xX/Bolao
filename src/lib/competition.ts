/**
 * MOTOR DAS COMPETIÇÕES INTERNAS — Liga, Copa e Consolação.
 *
 * Funções PURAS e sem efeitos colaterais. Quando um sorteio é necessário,
 * aceitam `rand: () => number` (padrão Math.random) para permitir testes
 * determinísticos. Quando recebem uma ordem já pronta (ex.: tabela da Liga),
 * mantêm o determinismo total.
 *
 * NÃO reimplementa pontuação de palpite: isso vive em '@/lib/scoring'.
 * Aqui tratamos apenas de chaveamento, blocos de rodada, grupos e desempates.
 */
import type {
  LeagueRound,
  LeagueFixtureConfronto,
  KORound,
  KOMatch,
  KOSlot,
  CupGroup,
} from '@/types';

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

/**
 * Fisher-Yates. Retorna uma NOVA lista embaralhada (não muta a original).
 * `rand` deve retornar [0,1). Padrão: Math.random.
 */
export function shuffle<T>(arr: T[], rand: () => number = Math.random): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = out[i];
    out[i] = out[j];
    out[j] = t;
  }
  return out;
}

/**
 * Divide uma lista de jogos (já ordenada por startTime) em blocos de `size`.
 * O último bloco pode ficar menor. `size` <= 0 devolve tudo num bloco só.
 */
export function splitIntoBlocks(orderedMatchIds: string[], size: number): string[][] {
  if (size <= 0) return orderedMatchIds.length ? [orderedMatchIds.slice()] : [];
  const blocks: string[][] = [];
  for (let i = 0; i < orderedMatchIds.length; i += size) {
    blocks.push(orderedMatchIds.slice(i, i + size));
  }
  return blocks;
}

// ---------------------------------------------------------------------------
// Liga — nº de rodadas e bloco máximo de jogos
// ---------------------------------------------------------------------------

/**
 * Nº de rodadas de um turno único (todos contra todos):
 *  - par  → n-1 rodadas
 *  - ímpar → n rodadas (um participante folga a cada rodada)
 * Menos de 2 participantes → 0.
 */
export function roundRobinRounds(numParticipants: number): number {
  if (numParticipants < 2) return 0;
  return numParticipants % 2 === 0 ? numParticipants - 1 : numParticipants;
}

/**
 * Bloco MÁXIMO de jogos por rodada da Liga, para os confrontos não quebrarem.
 * Como o nº de rodadas é fixo pelo round-robin, precisamos de
 * (rodadas × bloco) ≤ total de jogos. Logo o bloco máximo é ⌊jogos / rodadas⌋.
 *
 * Ex.: 8 pessoas (7 rodadas), 30 jogos → ⌊30/7⌋ = 4 (usa 28, sobram 2).
 *      10 pessoas (9 rodadas), 30 jogos → ⌊30/9⌋ = 3.
 *      10 pessoas (9 rodadas), 26 jogos → ⌊26/9⌋ = 2.
 * Retorna 0 quando não há jogos suficientes nem para 1 por rodada.
 */
export function maxBlockSize(numParticipants: number, totalGames: number): number {
  const rounds = roundRobinRounds(numParticipants);
  if (rounds <= 0) return 0;
  return Math.floor(totalGames / rounds);
}

// ---------------------------------------------------------------------------
// Copa e Consolação — nº de confrontos (rodadas) e bloco máximo de jogos
// ---------------------------------------------------------------------------

/**
 * Nº de rodadas de um mata-mata de eliminação simples para `n` participantes
 * (byes completam até a potência de 2). Ex.: 16→4, 8→3, 5→3, 2→1, 1→0.
 * É quantos confrontos alguém joga até (e incluindo) a final.
 */
export function knockoutRounds(n: number): number {
  if (n < 2) return 0;
  let size = 1;
  let r = 0;
  while (size < n) {
    size *= 2;
    r++;
  }
  return r;
}

/**
 * Nº TOTAL de confrontos (rodadas) da Copa — cada rodada soma um bloco de jogos.
 *  - 'knockout': só o mata-mata → knockoutRounds(participantes).
 *  - 'groups': rodadas da fase de grupos (turno único dentro do grupo) +
 *    rodadas do mata-mata entre os classificados.
 *
 * Ex.: 16 participantes, só mata-mata → 4 rodadas.
 *      16 participantes, grupos de 4, passam 2 → 4 grupos → 8 classificados:
 *      fase de grupos = 3 rodadas (turno de 4) + mata-mata (quartas→final) = 3
 *      → total 6 rodadas.
 */
export function cupRoundCount(
  format: 'knockout' | 'groups',
  numParticipants: number,
  groupSize?: number,
  qualifiersPerGroup?: number,
): number {
  if (format === 'knockout') return knockoutRounds(numParticipants);
  const gs = Math.max(2, groupSize ?? 4);
  const qpg = Math.max(1, qualifiersPerGroup ?? 2);
  const numGroups = Math.max(1, Math.ceil(numParticipants / gs));
  const groupPhaseRounds = roundRobinRounds(gs);
  const qualifiers = numGroups * qpg;
  return groupPhaseRounds + knockoutRounds(qualifiers);
}

/** Bloco máximo de jogos por confronto da Copa: ⌊jogos / rodadas da Copa⌋. */
export function maxCupBlock(cupRounds: number, totalGames: number): number {
  if (cupRounds <= 0) return 0;
  return Math.floor(totalGames / cupRounds);
}

/**
 * Bloco máximo (e se sobrepõe a Liga) da Copa da Consolação, que começa APÓS
 * a Liga. Usa os jogos que sobram depois da Liga; se a Liga consumiu jogos
 * demais, permite sobrepor o FIM da Liga (janela curta no final).
 *
 * Ex.: 80 jogos, Liga usou 70, Consolação com 2 rodadas → sobram 10 → máx 5.
 *      80 jogos, Liga usou 80 → sem sobra → sobrepõe o fim (overlaps=true).
 */
export function consolationBlockInfo(
  consolationRounds: number,
  totalGames: number,
  ligaGamesUsed: number,
): { maxBlock: number; overlaps: boolean; leftover: number } {
  if (consolationRounds <= 0) return { maxBlock: 0, overlaps: false, leftover: 0 };
  const leftover = Math.max(0, totalGames - ligaGamesUsed);
  if (leftover >= consolationRounds) {
    return { maxBlock: Math.floor(leftover / consolationRounds), overlaps: false, leftover };
  }
  // Liga consumiu jogos demais → a Consolação sobrepõe o fim da competição.
  return { maxBlock: Math.floor(totalGames / consolationRounds), overlaps: true, leftover };
}

// ---------------------------------------------------------------------------
// Liga — round-robin (método do círculo)
// ---------------------------------------------------------------------------

/**
 * Gera `rounds` rodadas de confrontos por pontos corridos usando o método do
 * círculo (circle method). Se o nº de jogadores for ímpar, adiciona um "bye"
 * (folga) → o adversário nesse par tem bUserId=null. Cicla caso `rounds` seja
 * maior que (n-1). Nunca gera auto-confronto.
 *
 * OBS: os IDs recebidos JÁ devem estar na ordem desejada (sorteie antes com
 * `shuffle` se quiser confrontos aleatórios).
 */
export function drawRoundRobin(playerIds: string[], rounds: number): LeagueRound[] {
  const players = playerIds.slice();
  const BYE = '__bye__';
  if (players.length % 2 !== 0) players.push(BYE);

  const n = players.length;
  const result: LeagueRound[] = [];
  if (n < 2 || rounds <= 0) return result;

  // Base de rodadas distintas do método do círculo: n-1 rodadas.
  const baseRounds = n - 1;
  const half = n / 2;

  // Fixa o primeiro; roda os demais.
  const rotating = players.slice(1);

  for (let r = 0; r < rounds; r++) {
    const rr = r % baseRounds; // cicla se pedirem mais que n-1
    // rotação: shift de `rr` posições
    const rotated = rotating.slice(rr).concat(rotating.slice(0, rr));
    const arrangement = [players[0], ...rotated];

    const confrontos: LeagueFixtureConfronto[] = [];
    for (let i = 0; i < half; i++) {
      const a = arrangement[i];
      const b = arrangement[n - 1 - i];
      if (a === BYE) {
        confrontos.push({ aUserId: b, bUserId: null });
      } else if (b === BYE) {
        confrontos.push({ aUserId: a, bUserId: null });
      } else {
        confrontos.push({ aUserId: a, bUserId: b });
      }
    }
    result.push({ round: r + 1, confrontos });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Mata-mata — nomes de fase e chaveamento
// ---------------------------------------------------------------------------

/** Nome da fase a partir do nº de CONFRONTOS (jogos) daquela rodada. */
export function stageName(matchesInRound: number): string {
  switch (matchesInRound) {
    case 1:
      return 'Final';
    case 2:
      return 'Semifinal';
    case 4:
      return 'Quartas';
    case 8:
      return 'Oitavas';
    case 16:
      return 'Pré-oitavas';
    default:
      // Fase de 32, 64... (nº de participantes = matchesInRound * 2)
      return `Fase de ${matchesInRound * 2}`;
  }
}

/** Menor potência de 2 >= n (mínimo 1). */
function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Ordem de seeds "equilibrada" (standard bracket seeding) para um bracket de
 * tamanho `size` (potência de 2). Retorna posições 1-based de seed, de forma
 * que 1 encontre o pior possível o mais tarde possível.
 * Ex.: size=4 → [1,4,2,3]; size=8 → [1,8,4,5,2,7,3,6].
 */
function seedOrder(size: number): number[] {
  let seeds = [1];
  while (seeds.length < size) {
    const next: number[] = [];
    const rounds = seeds.length * 2;
    for (const s of seeds) {
      next.push(s);
      next.push(rounds + 1 - s);
    }
    seeds = next;
  }
  return seeds;
}

/**
 * Monta o bracket a partir de jogadores JÁ ordenados por força/semente
 * (index 0 = seed 1 = melhor). Faz seeding equilibrado (1 vs último) e
 * completa com byes até a próxima potência de 2. Byes já avançam o jogador
 * (winnerId preenchido) na 1ª fase. As demais fases vêm com slots vazios,
 * com stage nomeado.
 */
export function buildBracket(playerIds: string[]): KORound[] {
  const n = playerIds.length;
  if (n === 0) return [];
  if (n === 1) {
    // Campeão único, sem jogo.
    return [
      {
        stage: 'Final',
        matches: [
          {
            id: 'ko-r1-m1',
            slotA: slotOf(playerIds[0]),
            slotB: null,
            byeB: true,
            winnerId: playerIds[0],
          },
        ],
      },
    ];
  }

  const size = nextPow2(n);
  const order = seedOrder(size); // seeds 1..size na ordem do bracket

  // Mapeia seed -> jogador (ou null se for slot de bye).
  const seedToPlayer: (string | null)[] = new Array(size + 1).fill(null);
  for (let i = 0; i < size; i++) {
    seedToPlayer[i + 1] = i < n ? playerIds[i] : null;
  }

  const firstRoundMatches: KOMatch[] = [];
  for (let i = 0; i < size; i += 2) {
    const seedA = order[i];
    const seedB = order[i + 1];
    const pA = seedToPlayer[seedA];
    const pB = seedToPlayer[seedB];
    const match: KOMatch = {
      id: `ko-r1-m${firstRoundMatches.length + 1}`,
      slotA: slotOf(pA),
      slotB: slotOf(pB),
    };
    if (pA && !pB) {
      match.byeB = true;
      match.winnerId = pA;
    } else if (pB && !pA) {
      match.byeA = true;
      match.winnerId = pB;
    }
    firstRoundMatches.push(match);
  }

  const rounds: KORound[] = [
    { stage: stageName(firstRoundMatches.length), matches: firstRoundMatches },
  ];

  // Fases seguintes: vazias, com metade dos jogos a cada passo.
  let count = firstRoundMatches.length;
  while (count > 1) {
    count = Math.floor(count / 2);
    const matches: KOMatch[] = [];
    for (let m = 0; m < count; m++) {
      matches.push({
        id: `ko-r${rounds.length + 1}-m${m + 1}`,
        slotA: null,
        slotB: null,
      });
    }
    rounds.push({ stage: stageName(count), matches });
  }

  // Propaga byes da 1ª fase para a fase seguinte.
  return propagateBracket(rounds);
}

function slotOf(userId: string | null | undefined): KOSlot {
  return userId ? { userId } : null;
}

/**
 * Recoloca os vencedores conhecidos (winnerId) na fase seguinte, respeitando
 * o pareamento padrão do bracket (match m alimenta o slot m/2 da próxima fase:
 * matches pares → slotA, ímpares → slotB). Não decide confrontos: apenas
 * propaga o que já está resolvido. Retorna NOVA estrutura (imutável).
 */
export function propagateBracket(rounds: KORound[]): KORound[] {
  // Clona fundo o suficiente para não mutar a entrada.
  const out: KORound[] = rounds.map((r) => ({
    stage: r.stage,
    matches: r.matches.map((m) => ({ ...m })),
  }));

  for (let r = 0; r < out.length - 1; r++) {
    const cur = out[r];
    const next = out[r + 1];
    for (let m = 0; m < cur.matches.length; m++) {
      const match = cur.matches[m];
      const winner = match.winnerId;
      if (!winner) continue;
      const targetIndex = Math.floor(m / 2);
      const target = next.matches[targetIndex];
      if (!target) continue;
      const slot: KOSlot = { userId: winner };
      if (m % 2 === 0) {
        target.slotA = slot;
      } else {
        target.slotB = slot;
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Desempate de confronto de mata-mata
// ---------------------------------------------------------------------------

/**
 * Decide um confronto de mata-mata.
 *  - Maior `points` vence.
 *  - Empate de pontos → melhor posição na Liga (menor leaguePos) avança.
 * `pointsEqual` sinaliza que houve empate de pontos (usado na UI / co-campeões
 * na final).
 */
export function resolveConfronto(
  a: { userId: string; points: number; leaguePos: number },
  b: { userId: string; points: number; leaguePos: number },
): { winnerId: string; pointsEqual: boolean } {
  if (a.points > b.points) return { winnerId: a.userId, pointsEqual: false };
  if (b.points > a.points) return { winnerId: b.userId, pointsEqual: false };
  // Empate de pontos: melhor posição (menor número) avança.
  const winnerId = a.leaguePos <= b.leaguePos ? a.userId : b.userId;
  return { winnerId, pointsEqual: true };
}

// ---------------------------------------------------------------------------
// Copa — fase de grupos
// ---------------------------------------------------------------------------

const GROUP_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Distribui participantes em grupos por sorteio. Cada grupo tem `groupSize`
 * membros; o ÚLTIMO grupo pode ficar menor se não dividir exato. Nomeia
 * 'Grupo A', 'Grupo B', ... Recebe `rand` para determinismo em testes.
 */
export function distributeGroups(
  playerIds: string[],
  groupSize: number,
  rand: () => number = Math.random,
): CupGroup[] {
  if (playerIds.length === 0) return [];
  const size = groupSize > 0 ? groupSize : playerIds.length;
  const shuffled = shuffle(playerIds, rand);
  const groups: CupGroup[] = [];
  for (let i = 0; i < shuffled.length; i += size) {
    const idx = groups.length;
    const name = `Grupo ${GROUP_LETTERS[idx] ?? String(idx + 1)}`;
    groups.push({ name, memberIds: shuffled.slice(i, i + size) });
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Consolação — semeadura best x worst
// ---------------------------------------------------------------------------

/**
 * Recebe os últimos da Liga JÁ ordenados do MELHOR (menos ruim) ao PIOR e
 * monta a 1ª fase pareando melhor x pior, 2º melhor x 2º pior, etc.
 * Retorna apenas os confrontos da 1ª fase (KOMatch[]). Se ímpar, o do meio
 * (o "melhor sobrando") recebe bye e avança direto.
 *
 * Para gerar as demais fases (vazias, nomeadas), use `buildConsolationRounds`.
 */
export function seedConsolation(orderedBestToWorst: string[]): KOMatch[] {
  const arr = orderedBestToWorst.slice();
  const matches: KOMatch[] = [];
  let left = 0;
  let right = arr.length - 1;
  let idx = 0;
  while (left < right) {
    matches.push({
      id: `ko-r1-m${idx + 1}`,
      slotA: slotOf(arr[left]),
      slotB: slotOf(arr[right]),
    });
    idx++;
    left++;
    right--;
  }
  if (left === right) {
    // Sobra do meio → bye, avança direto.
    matches.push({
      id: `ko-r1-m${idx + 1}`,
      slotA: slotOf(arr[left]),
      slotB: null,
      byeB: true,
      winnerId: arr[left],
    });
  }
  return matches;
}

/**
 * Monta o bracket COMPLETO da Consolação a partir dos últimos da Liga
 * ordenados do MELHOR ao PIOR: 1ª fase por `seedConsolation` + demais fases
 * vazias, com propagação de byes. (Conveniência sobre `seedConsolation`.)
 */
export function buildConsolationRounds(orderedBestToWorst: string[]): KORound[] {
  const first = seedConsolation(orderedBestToWorst);
  if (first.length === 0) return [];
  const rounds: KORound[] = [{ stage: stageName(first.length), matches: first }];

  let count = first.length;
  while (count > 1) {
    count = Math.floor(count / 2);
    const matches: KOMatch[] = [];
    for (let m = 0; m < count; m++) {
      matches.push({ id: `ko-r${rounds.length + 1}-m${m + 1}`, slotA: null, slotB: null });
    }
    rounds.push({ stage: stageName(count), matches });
  }
  return propagateBracket(rounds);
}

// ---------------------------------------------------------------------------
// Resolução AO VIVO do mata-mata (Copa / Consolação)
// ---------------------------------------------------------------------------

/**
 * Resolve um mata-mata AO VIVO a partir do bracket inicial e dos pontos de cada
 * rodada. Função PURA (não muta os argumentos).
 *
 * Para cada rodada `r` (0-based):
 *  - se `roundPoints[r]` for `null` (bloco ainda não terminou), PARA: essa
 *    rodada e as seguintes ficam "a definir" (sem winnerId).
 *  - senão, para cada KOMatch com slotA e slotB definidos, soma os pontos de
 *    cada lado (`roundPoints[r][userId] ?? 0`), decide com `resolveConfronto`
 *    (empate de pontos → melhor posição na Liga) e grava
 *    pointsA/pointsB/winnerId/pointsEqual. Depois propaga os vencedores para a
 *    rodada seguinte antes de resolvê-la.
 *
 * Byes (slot único com winnerId já definido) são preservados e propagados.
 *
 * FINAL (última rodada): se resolver com `pointsEqual` → co-campeões
 * (coChampions=true, championIds com os DOIS). Senão, championIds = [vencedor].
 * O empate na final NÃO é desempatado pela Liga — vira co-campeonato.
 */
export function resolveKnockout(
  initialRounds: KORound[],
  roundPoints: (Record<string, number> | null)[],
  leaguePos: Record<string, number>,
): { rounds: KORound[]; championIds: string[] } {
  // Clona fundo o suficiente para não mutar a entrada.
  let rounds: KORound[] = initialRounds.map((r) => ({
    stage: r.stage,
    matches: r.matches.map((m) => ({ ...m })),
  }));

  const lastIndex = rounds.length - 1;
  let championIds: string[] = [];

  for (let r = 0; r < rounds.length; r++) {
    const pts = roundPoints[r];
    if (pts == null) {
      // Bloco não terminou → para aqui; rodadas seguintes ficam a definir.
      break;
    }

    const isFinal = r === lastIndex;
    const cur = rounds[r];

    for (const match of cur.matches) {
      // Bye ou já resolvido por avanço direto: mantém como está.
      if (!match.slotA || !match.slotB) continue;

      const aId = match.slotA.userId;
      const bId = match.slotB.userId;
      const pointsA = pts[aId] ?? 0;
      const pointsB = pts[bId] ?? 0;

      const decision = resolveConfronto(
        { userId: aId, points: pointsA, leaguePos: leaguePos[aId] ?? Number.POSITIVE_INFINITY },
        { userId: bId, points: pointsB, leaguePos: leaguePos[bId] ?? Number.POSITIVE_INFINITY },
      );

      match.pointsA = pointsA;
      match.pointsB = pointsB;
      match.pointsEqual = decision.pointsEqual;

      if (isFinal && decision.pointsEqual) {
        // Empate na final = co-campeões (a Liga NÃO decide a final).
        match.coChampions = true;
        match.winnerId = null;
        championIds = [aId, bId];
      } else {
        match.winnerId = decision.winnerId;
        if (isFinal) championIds = [decision.winnerId];
      }
    }

    // Final resolvida por bye (um lado só, winnerId já definido).
    if (isFinal && championIds.length === 0) {
      const finalMatch = cur.matches[0];
      if (finalMatch && finalMatch.winnerId) championIds = [finalMatch.winnerId];
    }

    // Propaga os vencedores para a rodada seguinte antes de resolvê-la.
    if (r < lastIndex) rounds = propagateBracket(rounds);
  }

  return { rounds, championIds };
}

/**
 * Ordena os membros de um grupo pela classificação: mais pontos primeiro;
 * empate de pontos desempata pela MELHOR posição na Liga (menor leaguePos).
 * Fallback estável: mantém a ordem de entrada quando pontos e posição empatam.
 * Não muta a entrada.
 */
export function rankGroupByPoints(
  memberIds: string[],
  points: Record<string, number>,
  leaguePos: Record<string, number>,
): string[] {
  return memberIds
    .map((id, i) => ({ id, i }))
    .sort((a, b) => {
      const pa = points[a.id] ?? 0;
      const pb = points[b.id] ?? 0;
      if (pb !== pa) return pb - pa; // mais pontos primeiro
      const la = leaguePos[a.id] ?? Number.POSITIVE_INFINITY;
      const lb = leaguePos[b.id] ?? Number.POSITIVE_INFINITY;
      if (la !== lb) return la - lb; // menor posição na Liga primeiro
      return a.i - b.i; // estável
    })
    .map((x) => x.id);
}
