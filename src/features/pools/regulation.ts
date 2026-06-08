import { Pool, PoolStatus } from '@/types';
import { colors } from '@/theme';

/**
 * Gera o texto do regulamento automaticamente a partir das regras
 * configuradas (seção 6.4 / RF do PRD). Em vez de o organizador
 * escrever um PDF, o app monta o regulamento sozinho.
 */
export interface RegulationSection {
  title: string;
  lines: string[];
}

export function buildRegulation(pool: Pool): RegulationSection[] {
  const s = pool.settings;
  const sections: RegulationSection[] = [];

  sections.push({
    title: 'Sobre o bolão',
    lines: [
      `Nome: ${pool.name}`,
      `Competição: ${pool.competitionName || '—'}`,
      `Tipo: ${pool.isPublic ? 'Público' : 'Privado (entrada por convite)'}`,
      pool.prize ? `Premiação: ${pool.prize}` : 'Premiação: a combinar',
    ],
  });

  sections.push({
    title: 'Pontuação',
    lines: [
      `Placar exato: ${s.scoring.exactScorePoints} ponto(s)`,
      `Acertar o vencedor: ${s.scoring.winnerPoints} ponto(s)`,
      `Acertar o empate: ${s.scoring.drawPoints} ponto(s)`,
      `Acertar classificado (mata-mata): ${s.scoring.qualifiedTeamPoints} ponto(s)`,
    ],
  });

  const modules: string[] = [];
  if (s.modules.overallRanking) modules.push('Ranking geral');
  if (s.modules.league) modules.push('Liga (pontos corridos)');
  if (s.modules.cup) modules.push('Copa (mata-mata)');
  if (s.modules.losersCup) modules.push('Copa dos Ruins');
  if (s.modules.longTermPredictions) modules.push('Palpites de longo prazo');
  sections.push({
    title: 'Disputas ativas',
    lines: modules.length ? modules : ['Apenas ranking geral'],
  });

  if (s.league.enabled) {
    sections.push({
      title: 'Liga',
      lines: [
        s.league.roundMode === 'matchBlock'
          ? `Rodadas por bloco de ${s.league.matchesPerRound} jogos`
          : 'Rodadas organizadas por data',
      ],
    });
  }

  if (s.cup.enabled) {
    sections.push({
      title: 'Copa',
      lines: [
        s.cup.startsAfterLeague
          ? 'A copa começa após o fim da liga'
          : `A copa usa corte na rodada ${s.cup.cutoffLeagueRound} da liga`,
        s.cup.seedingMode === 'leagueStanding'
          ? 'Chaveamento por classificação da liga'
          : 'Chaveamento sorteado',
      ],
    });
  }

  const visMap: Record<string, string> = {
    visible_before_kickoff: 'Palpites visíveis antes do jogo',
    hidden_until_kickoff: 'Palpites ocultos até o início da partida',
    hidden_until_round_end: 'Palpites ocultos até o fim da rodada',
  };
  sections.push({
    title: 'Visibilidade dos palpites',
    lines: [visMap[s.predictionsVisibility.mode]],
  });

  sections.push({
    title: 'Regras gerais',
    lines: [
      'O palpite só pode ser editado até o horário de início do jogo.',
      'Após o início, o palpite é travado e não pode mais ser alterado.',
      'A pontuação é calculada automaticamente com o resultado oficial.',
      'As regras do bolão não mudam após o início da competição.',
    ],
  });

  return sections;
}

export const statusLabel: Record<PoolStatus, string> = {
  draft: 'Rascunho',
  open: 'Aberto',
  ongoing: 'Em andamento',
  finished: 'Encerrado',
};

export const statusColor: Record<PoolStatus, string> = {
  draft: colors.grayMedium,
  open: colors.success,
  ongoing: colors.info,
  finished: colors.grayMedium,
};
