/**
 * Modelo de dados do Bolão da Copa (Firestore).
 * Espelha a seção 15 do PRD. Regras FIXAS — não é construtor genérico.
 */
import type { Timestamp } from 'firebase/firestore';

export type FireDate = Timestamp | number | null;

// ---------------------------------------------------------------------------
// Usuário e participação
// ---------------------------------------------------------------------------
export interface UserProfile {
  id: string;
  nickname: string;
  avatarUrl?: string | null;
  email: string;
  isSystemAdmin?: boolean;
  createdAt: FireDate;
}

export type MemberRole = 'participant' | 'organizer';

export interface EditionMember {
  id: string; // `${editionId}_${userId}`
  editionId: string;
  userId: string;
  nickname: string;
  avatarUrl?: string | null;
  role: MemberRole;
  joinedAt: FireDate;
  // agregados de leitura rápida (mantidos pelo backend):
  totalPoints: number;
  exactHits: number;   // Rei da Cravada (3 e 4 pts)
  winnerHits: number;  // Bom de Palpite (1 e 2 pts)
}

// ---------------------------------------------------------------------------
// Edição (uma por Copa) + premiação
// ---------------------------------------------------------------------------
export type EditionStatus = 'draft' | 'longterm_open' | 'running' | 'finished';

export interface EditionPrizes {
  ranking: { first: number; second: number; third: number };
  league: { first: number; second: number; third: number };
  cup: { total: number };          // dividido se co-campeões
  longTerm: { perMarket: number }; // base por mercado (redistribui se ninguém acerta)
}

// Configurações das competições internas (Liga, Copa, Consolação).
// Definidas pelo organizador na criação/preparação da edição.
export interface EditionSettings {
  league: {
    matchesPerRound: number; // N jogos consecutivos por rodada (padrão 4)
    winPoints: number;       // pontos por vitória no confronto (padrão 3)
    drawPoints: number;      // pontos por empate no confronto (padrão 1)
  };
  cup: {
    format: 'knockout' | 'groups';
    groupSize?: number;          // participantes por grupo (format 'groups')
    qualifiersPerGroup?: number; // quantos passam de cada grupo
  };
  consolation: {
    lastN: number; // quantos ÚLTIMOS da Liga entram na Consolação
  };
}

export interface Edition {
  id: string;
  name: string;              // ex: "Copa 2026"
  competitionId: string;     // competição real associada
  competitionName?: string;
  status: EditionStatus;
  inviteCode: string;
  prizes: EditionPrizes;
  settings?: EditionSettings;
  memberCount: number;
  ownerId: string;
  createdAt: FireDate;
}

// ---------------------------------------------------------------------------
// Liga (fase de pontos corridos / confrontos por rodada)
// ---------------------------------------------------------------------------
export interface LeagueFixtureConfronto {
  aUserId: string;
  bUserId: string | null; // null = folga (bye) na rodada
}

export interface LeagueRound {
  round: number; // 1-based
  confrontos: LeagueFixtureConfronto[];
}

export interface LeagueDoc {
  id: string;
  editionId: string;
  matchesPerRound: number;
  rounds: LeagueRound[];
  createdAt: FireDate;
}

export interface LeagueTableRow {
  userId: string;
  nickname?: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  leaguePoints: number;
  pointsFor: number; // soma dos pontos-pró (pontos de palpite acumulados)
  position: number;  // 1-based, após ordenação
}

// ---------------------------------------------------------------------------
// Mata-mata (Copa e Consolação)
// ---------------------------------------------------------------------------
export type KOSlot = { userId: string; nickname?: string } | null;

export interface KOMatch {
  id: string;
  slotA: KOSlot;
  slotB: KOSlot;
  byeA?: boolean; // slotA folga (avança direto)
  byeB?: boolean; // slotB folga (avança direto)
  pointsA?: number | null;
  pointsB?: number | null;
  winnerId?: string | null;
  pointsEqual?: boolean;  // empate de pontos (desempate por posição na Liga)
  coChampions?: boolean;  // só na final: empate = co-campeões
  matchIds?: string[];    // jogos reais que decidem este confronto
}

export interface KORound {
  stage: string; // 'Final' | 'Semifinal' | 'Quartas' | ...
  matches: KOMatch[];
}

export interface CupGroup {
  name: string; // 'Grupo A', 'Grupo B', ...
  memberIds: string[];
}

export interface BracketDoc {
  id: string;
  editionId: string;
  type: 'cup' | 'consolation';
  format?: 'knockout' | 'groups';
  groups?: CupGroup[];
  qualifiersPerGroup?: number;
  rounds: KORound[];
  championIds?: string[]; // 1 campeão, ou 2 se co-campeões
  createdAt: FireDate;
}

// ---------------------------------------------------------------------------
// Times (seleções) e jogos reais
// ---------------------------------------------------------------------------
export interface Team {
  id: string;
  name: string;
  flag?: string | null;   // emoji ou URL da bandeira
  code?: string;          // ex: BRA
}

export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'postponed' | 'canceled';

export interface Match {
  id: string;
  editionId: string;
  externalId?: string;
  homeTeam: Team;
  awayTeam: Team;
  startTime: FireDate;
  status: MatchStatus;
  homeScore: number | null;   // placar usado para o palpite (tempo normal)
  awayScore: number | null;
  stage?: string;             // 'group' | 'round_of_16' | 'quarter' | ...
  round?: number | null;
  isKnockout: boolean;
  // Preenchidos só em mata-mata decidido nos pênaltis:
  decidedByPenalties?: boolean;
  penaltyWinnerTeamId?: string | null;
  lastSyncedAt?: FireDate;
}

// ---------------------------------------------------------------------------
// Palpites
// ---------------------------------------------------------------------------
export interface Prediction {
  id: string; // `${editionId}_${userId}_${matchId}`
  editionId: string;
  userId: string;
  matchId: string;
  predictedHome: number;
  predictedAway: number;
  // Só em mata-mata: seleção que o participante acha que se classifica nos pênaltis.
  predictedPenaltyWinner?: string | null;
  submittedAt: FireDate;
  lockedAt?: FireDate;
  pointsAwarded?: number | null;
}

export type LongTermMarket = 'champion' | 'topScorer' | 'assistLeader' | 'bestPlayer';

export interface LongTermPrediction {
  id: string; // `${editionId}_${userId}`
  editionId: string;
  userId: string;
  championTeam?: string | null;
  topScorer?: string | null;
  assistLeader?: string | null;
  bestPlayer?: string | null;
  submittedAt: FireDate;
}

// ---------------------------------------------------------------------------
// Longo Prazo — gabarito (respostas certas) e premiação
// ---------------------------------------------------------------------------

/** Gabarito dos 4 mercados de longo prazo (respostas certas). */
export interface LongTermGabarito {
  championTeam?: string | null;
  topScorer?: string | null;
  assistLeader?: string | null;
  bestPlayer?: string | null;
}

/** Uma linha de origem de prêmio (ex.: 'Ranking 1º' → R$100). */
export interface PayoutBreakdownItem {
  source: string;
  amount: number;
}

/** Quanto um participante recebe no total, com a quebra por origem. */
export interface UserPayout {
  userId: string;
  nickname?: string;
  total: number;
  breakdown: PayoutBreakdownItem[];
}

/** Resultado completo do rateio de premiação de uma edição. */
export interface PayoutResult {
  byUser: Record<string, UserPayout>;
  pool: number;        // soma das contribuições
  distributed: number; // soma de tudo o que foi distribuído
  perMarketPot: Record<string, number>; // pote final de cada mercado de longo prazo
}

/** Uma linha de estatística (ex.: Rei da Cravada). */
export interface StatRow {
  userId: string;
  nickname?: string;
  value: number;
}

/** Documento persistido com contribuições e gabarito (base da premiação). */
export interface PayoutsDoc {
  id: string;
  editionId: string;
  contributions: Record<string, number>;
  gabarito: LongTermGabarito;
  updatedAt: FireDate;
}

// ---------------------------------------------------------------------------
// Feed (mural da edição) — só o organizador posta; membros leem.
// ---------------------------------------------------------------------------
export interface FeedPost {
  id: string;
  editionId: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: FireDate;
}
