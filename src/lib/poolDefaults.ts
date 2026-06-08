import { PoolSettings, PoolTemplate } from '@/types';

/**
 * Configurações padrão de um bolão. Servem de ponto de partida no
 * wizard de criação. O usuário pode ajustar tudo antes de publicar.
 */
export const defaultSettings: PoolSettings = {
  scoring: {
    exactScorePoints: 3,
    winnerPoints: 1,
    drawPoints: 1,
    qualifiedTeamPoints: 1,
  },
  modules: {
    overallRanking: true,
    league: false,
    cup: false,
    losersCup: false,
    longTermPredictions: false,
  },
  league: {
    enabled: false,
    roundMode: 'matchBlock',
    matchesPerRound: 4,
    seedSource: 'manualOrGenerated',
  },
  cup: {
    enabled: false,
    startsAfterLeague: false,
    cutoffLeagueRound: 17,
    seedingMode: 'leagueStanding',
  },
  predictionsVisibility: {
    mode: 'hidden_until_kickoff',
  },
};

/**
 * Templates prontos (recomendação 1 do PRD). Em vez de o iniciante
 * configurar tudo na mão, ele escolhe um template e ajusta o resto.
 */
export const templates: Record<
  PoolTemplate,
  { label: string; description: string; apply: (s: PoolSettings) => PoolSettings }
> = {
  classic: {
    label: 'Bolão Clássico',
    description: 'Só palpites e ranking geral. Simples e direto.',
    apply: (s) => ({
      ...s,
      modules: { ...s.modules, league: false, cup: false, longTermPredictions: false },
      league: { ...s.league, enabled: false },
      cup: { ...s.cup, enabled: false },
    }),
  },
  league: {
    label: 'Bolão com Liga',
    description: 'Ranking geral + classificação de liga por rodadas.',
    apply: (s) => ({
      ...s,
      modules: { ...s.modules, league: true, cup: false },
      league: { ...s.league, enabled: true },
      cup: { ...s.cup, enabled: false },
    }),
  },
  leagueCup: {
    label: 'Liga + Copa',
    description: 'Liga por pontos corridos e copa de mata-mata.',
    apply: (s) => ({
      ...s,
      modules: { ...s.modules, league: true, cup: true },
      league: { ...s.league, enabled: true },
      cup: { ...s.cup, enabled: true },
    }),
  },
  official: {
    label: 'Bolão Oficial',
    description: 'Formato completo gerenciado pelo sistema.',
    apply: (s) => ({
      ...s,
      modules: {
        overallRanking: true,
        league: true,
        cup: true,
        losersCup: true,
        longTermPredictions: true,
      },
      league: { ...s.league, enabled: true },
      cup: { ...s.cup, enabled: true },
    }),
  },
};
