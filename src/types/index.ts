/**
 * Tipos de dados centrais do Bolão Flex.
 * Espelham as coleções do Firestore descritas no PRD (seção 17).
 * Ter tipos fortes ajuda o editor a te autocompletar e evita bugs.
 */

import { Timestamp } from 'firebase/firestore';

// Aceita tanto Timestamp do Firestore quanto número (ms) para flexibilidade.
export type FireDate = Timestamp | number | null;

// ---------------------------------------------------------------------------
// Usuário
// ---------------------------------------------------------------------------
export interface UserProfile {
  id: string;
  name: string;
  username?: string;
  email: string;
  avatarUrl?: string | null;
  createdAt: FireDate;
  isSystemAdmin?: boolean;
  stats?: {
    poolsCreated?: number;
    poolsJoined?: number;
    totalPoints?: number;
  };
}

// ---------------------------------------------------------------------------
// Competição real (ex: Brasileirão 2026)
// ---------------------------------------------------------------------------
export type CompetitionStatus = 'upcoming' | 'ongoing' | 'finished';

export interface Competition {
  id: string;
  sportType: 'football';
  name: string;
  season: string;
  status: CompetitionStatus;
  sourceProvider?: string;
  logoUrl?: string | null;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Partida real
// ---------------------------------------------------------------------------
export type MatchStatus =
  | 'scheduled'
  | 'live'
  | 'finished'
  | 'postponed'
  | 'canceled';

export interface Team {
  id: string;
  name: string;
  shortName?: string;
  crestUrl?: string | null;
}

export interface Match {
  id: string;
  competitionId: string;
  externalId?: string;
  homeTeam: Team;
  awayTeam: Team;
  startTime: FireDate;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  stage?: string; // 'group' | 'round_of_16' | ...
  round?: number;
  group?: string | null;
  lastSyncedAt?: FireDate;
}

// ---------------------------------------------------------------------------
// Bolão e suas regras
// ---------------------------------------------------------------------------
export type PoolStatus = 'draft' | 'open' | 'ongoing' | 'finished';

export interface ScoringRules {
  exactScorePoints: number; // acertar placar exato
  winnerPoints: number; // acertar o vencedor
  drawPoints: number; // acertar o empate
  qualifiedTeamPoints: number; // acertar classificado (mata-mata)
}

export interface PoolModules {
  overallRanking: boolean;
  league: boolean;
  cup: boolean;
  losersCup: boolean;
  longTermPredictions: boolean;
}

export type PredictionsVisibility =
  | 'visible_before_kickoff'
  | 'hidden_until_kickoff'
  | 'hidden_until_round_end';

export interface PoolSettings {
  scoring: ScoringRules;
  modules: PoolModules;
  league: {
    enabled: boolean;
    roundMode: 'matchBlock' | 'byDate';
    matchesPerRound: number;
    seedSource: 'manualOrGenerated' | 'leagueStanding';
  };
  cup: {
    enabled: boolean;
    startsAfterLeague: boolean;
    cutoffLeagueRound: number;
    seedingMode: 'leagueStanding' | 'random';
  };
  predictionsVisibility: {
    mode: PredictionsVisibility;
  };
}

export interface Pool {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  description?: string;
  isPublic: boolean;
  inviteCode: string;
  coverImageUrl?: string | null;
  competitionId: string;
  competitionName?: string;
  status: PoolStatus;
  rulesVersion: number;
  settings: PoolSettings;
  prize?: string;
  maxParticipants?: number | null;
  memberCount: number;
  createdByAdmin: boolean;
  createdAt: FireDate;
}

export type MemberRole = 'owner' | 'admin' | 'member';
export type MemberStatus = 'active' | 'pending' | 'removed';

export interface PoolMember {
  id: string; // normalmente `${poolId}_${userId}`
  poolId: string;
  userId: string;
  userName: string;
  userAvatarUrl?: string | null;
  role: MemberRole;
  status: MemberStatus;
  joinedAt: FireDate;
  // Cache de pontuação para ranking rápido:
  totalPoints: number;
  exactHits: number;
  winnerHits: number;
}

// ---------------------------------------------------------------------------
// Palpites
// ---------------------------------------------------------------------------
export interface Prediction {
  id: string; // `${poolId}_${userId}_${matchId}`
  poolId: string;
  userId: string;
  matchId: string;
  predictedHome: number;
  predictedAway: number;
  predictedQualifiedTeamId?: string | null;
  submittedAt: FireDate;
  lockedAt?: FireDate;
  pointsAwarded?: number | null;
}

export interface LongTermPrediction {
  id: string;
  poolId: string;
  userId: string;
  championTeamId?: string | null;
  runnerUpTeamId?: string | null;
  topScorerPlayerId?: string | null;
  bestPlayerId?: string | null;
  assistLeaderPlayerId?: string | null;
  submittedAt: FireDate;
}

// ---------------------------------------------------------------------------
// Helpers de template (seção 29 do PRD)
// ---------------------------------------------------------------------------
export type PoolTemplate = 'classic' | 'league' | 'leagueCup' | 'official';
