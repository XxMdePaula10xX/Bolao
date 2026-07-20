/**
 * SERVIÇO DE ESTATÍSTICAS.
 *
 * Reúne membros, jogos, palpites, matchesPerRound (settings) e a tabela da Liga
 * e delega o cálculo à função pura `computeStats` (lib/stats).
 */
import { listEditionMembers, getEdition } from '@/services/editions';
import { loadScoreData, computeLeagueTableFrom, getLeague } from '@/services/league';
import { computeStats } from '@/lib/stats';
import type { LeagueTableRow, Match } from '@/types';

/** Carrega tudo o que a edição precisa e devolve as estatísticas prontas. */
export async function getStats(
  editionId: string,
): Promise<ReturnType<typeof computeStats>> {
  // Carrega os dados de pontuação UMA vez e reaproveita para a tabela da Liga,
  // em vez de deixar computeLeagueTable reler todas as predictions.
  const [members, edition, data, league] = await Promise.all([
    listEditionMembers(editionId),
    getEdition(editionId),
    loadScoreData(editionId),
    getLeague(editionId),
  ]);

  const leagueTable: LeagueTableRow[] = league
    ? (await computeLeagueTableFrom(editionId, data, league)).table
    : [];

  // matches na ordem por startTime asc (a mesma usada nos blocos).
  const matches: Match[] = data.orderedMatchIds
    .map((id) => data.matchesById[id])
    .filter((m): m is Match => m != null);

  const matchesPerRound = edition?.settings?.league.matchesPerRound ?? 4;

  return computeStats({
    members,
    matches,
    predsByUser: data.predsByUser,
    matchesPerRound,
    leagueTable,
  });
}
