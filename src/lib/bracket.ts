/**
 * Geração de chaveamento de mata-mata (copa) — seção 6.9 do PRD.
 *
 * Numa copa de bolão, quem se enfrenta são os PARTICIPANTES (não os
 * times reais). Esta lógica é pura: recebe a lista de participantes já
 * ordenada por seed (ex.: classificação) e devolve a estrutura do
 * chaveamento, com "byes" quando o número não é potência de 2 e os
 * confrontos já preenchidos na primeira fase.
 */

export interface BracketSlot {
  userId: string;
  userName: string;
}

export interface BracketMatch {
  id: string;
  slotA: BracketSlot | null; // null = vaga ainda indefinida (TBD)
  slotB: BracketSlot | null;
  byeA?: boolean; // o lado A é um "bye" (passa direto)
  byeB?: boolean;
  winnerId: string | null;
}

export interface BracketRound {
  stage: string;
  matches: BracketMatch[];
}

export interface BracketData {
  rounds: BracketRound[];
}

/** Nome da fase a partir da quantidade de confrontos da rodada. */
export function stageName(matchesInRound: number): string {
  switch (matchesInRound) {
    case 1:
      return 'Final';
    case 2:
      return 'Semifinal';
    case 4:
      return 'Quartas de final';
    case 8:
      return 'Oitavas de final';
    case 16:
      return 'Pré-oitavas';
    default:
      return `Fase de ${matchesInRound * 2}`;
  }
}

/** Próxima potência de 2 maior ou igual a n (mínimo 2). */
function nextPowerOfTwo(n: number): number {
  let p = 2;
  while (p < n) p *= 2;
  return p;
}

/**
 * Ordem de seeds de um chaveamento equilibrado (1 vs último, etc.).
 * Ex.: size 8 -> [1,8,5,4,3,6,7,2].
 */
function seedOrder(size: number): number[] {
  let seeds = [1, 2];
  while (seeds.length < size) {
    const sum = seeds.length * 2 + 1;
    const next: number[] = [];
    for (const s of seeds) {
      next.push(s);
      next.push(sum - s);
    }
    seeds = next;
  }
  return seeds;
}

/**
 * Gera o chaveamento completo. `participants` deve vir ordenado:
 * o primeiro é o seed 1, o segundo o seed 2, e assim por diante.
 */
export function generateBracket(participants: BracketSlot[]): BracketData {
  const n = participants.length;
  if (n < 2) {
    return { rounds: [] };
  }

  const size = nextPowerOfTwo(n);
  const order = seedOrder(size);

  // Primeira fase: monta os confrontos seguindo a ordem de seeds.
  const firstMatches: BracketMatch[] = [];
  for (let i = 0; i < size; i += 2) {
    const seedA = order[i];
    const seedB = order[i + 1];
    const a = seedA <= n ? participants[seedA - 1] : null;
    const b = seedB <= n ? participants[seedB - 1] : null;
    const byeA = a === null;
    const byeB = b === null;

    // Se um lado é bye, o outro avança automaticamente.
    let winnerId: string | null = null;
    if (byeA && b) winnerId = b.userId;
    else if (byeB && a) winnerId = a.userId;

    firstMatches.push({
      id: `r0_m${i / 2}`,
      slotA: a,
      slotB: b,
      byeA,
      byeB,
      winnerId,
    });
  }

  const rounds: BracketRound[] = [
    { stage: stageName(firstMatches.length), matches: firstMatches },
  ];

  // Demais fases (vazias, a serem preenchidas conforme avançam).
  let count = firstMatches.length;
  let roundIndex = 1;
  while (count > 1) {
    const matchesInRound = count / 2;
    const matches: BracketMatch[] = [];
    for (let m = 0; m < matchesInRound; m++) {
      matches.push({
        id: `r${roundIndex}_m${m}`,
        slotA: null,
        slotB: null,
        winnerId: null,
      });
    }
    rounds.push({ stage: stageName(matchesInRound), matches });
    count = matchesInRound;
    roundIndex++;
  }

  // Propaga os vencedores de byes para a 2ª fase já na geração.
  propagateWinners(rounds);

  return { rounds };
}

/**
 * Recalcula a colocação dos vencedores nas fases seguintes a partir
 * dos `winnerId` definidos. Chamado após cada vez que um vencedor é
 * escolhido. Mantém o chaveamento consistente.
 */
export function propagateWinners(rounds: BracketRound[]): void {
  for (let r = 0; r < rounds.length - 1; r++) {
    const current = rounds[r].matches;
    const next = rounds[r + 1].matches;
    for (let i = 0; i < current.length; i++) {
      const match = current[i];
      const target = next[Math.floor(i / 2)];
      const slot: 'slotA' | 'slotB' = i % 2 === 0 ? 'slotA' : 'slotB';
      if (match.winnerId) {
        const winner =
          match.slotA?.userId === match.winnerId
            ? match.slotA
            : match.slotB?.userId === match.winnerId
              ? match.slotB
              : null;
        target[slot] = winner;
      } else {
        target[slot] = null;
        // Se o vencedor anterior sumiu, limpa também o vencedor seguinte.
        if (target.winnerId === match.slotA?.userId || target.winnerId === match.slotB?.userId) {
          target.winnerId = null;
        }
      }
    }
  }
}

/** Marca um vencedor em um confronto e propaga para as fases seguintes. */
export function setWinner(
  data: BracketData,
  roundIndex: number,
  matchId: string,
  winnerId: string
): BracketData {
  const rounds = JSON.parse(JSON.stringify(data.rounds)) as BracketRound[];
  const match = rounds[roundIndex]?.matches.find((m) => m.id === matchId);
  if (match) {
    match.winnerId = winnerId;
  }
  propagateWinners(rounds);
  return { rounds };
}

/** Devolve o campeão, se a final já tiver vencedor. */
export function getChampion(data: BracketData): BracketSlot | null {
  const final = data.rounds[data.rounds.length - 1]?.matches[0];
  if (!final?.winnerId) return null;
  if (final.slotA?.userId === final.winnerId) return final.slotA;
  if (final.slotB?.userId === final.winnerId) return final.slotB;
  return null;
}
