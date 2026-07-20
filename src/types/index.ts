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

export interface Edition {
  id: string;
  name: string;              // ex: "Copa 2026"
  competitionId: string;     // competição real associada
  competitionName?: string;
  status: EditionStatus;
  inviteCode: string;
  prizes: EditionPrizes;
  memberCount: number;
  ownerId: string;
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
