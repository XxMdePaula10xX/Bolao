/**
 * Cloud Functions do Bolão Flex.
 *
 * Função principal do MVP: quando um jogo é marcado como "finished"
 * (com placar), recalculamos a pontuação de TODOS os palpites daquele
 * jogo, em todos os bolões que usam aquela competição, e atualizamos
 * o ranking (campos agregados em poolMembers).
 *
 * Isto centraliza o cálculo no servidor (PRD seção 24), garantindo
 * que ninguém consiga forjar pontos pelo app.
 */
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';
import { calculatePoints, isExactHit, ScoringRules } from './scoring';

admin.initializeApp();
const db = admin.firestore();

/**
 * Gatilho: disparado sempre que um documento em /matches muda.
 * Só age quando o jogo acabou de ser finalizado com placar válido.
 */
export const onMatchFinished = onDocumentWritten('matches/{matchId}', async (event) => {
  const after = event.data?.after.data();
  const before = event.data?.before.data();
  if (!after) return;

  const justFinished =
    after.status === 'finished' &&
    after.homeScore != null &&
    after.awayScore != null &&
    (before?.status !== 'finished' ||
      before?.homeScore !== after.homeScore ||
      before?.awayScore !== after.awayScore);

  if (!justFinished) return;

  const matchId = event.params.matchId;
  logger.info(`Recalculando pontuação do jogo ${matchId}`);

  await scoreMatch(matchId, after.homeScore, after.awayScore);
});

/**
 * Função "callable" para o admin forçar o recálculo de um jogo
 * manualmente (útil em testes ou correções).
 */
export const recalcMatch = onCall(async (request) => {
  const matchId = request.data?.matchId as string;
  if (!matchId) throw new HttpsError('invalid-argument', 'matchId é obrigatório.');

  const matchSnap = await db.doc(`matches/${matchId}`).get();
  const match = matchSnap.data();
  if (!match || match.homeScore == null || match.awayScore == null) {
    throw new HttpsError('failed-precondition', 'Jogo sem placar final.');
  }
  await scoreMatch(matchId, match.homeScore, match.awayScore);
  return { ok: true };
});

/**
 * Núcleo do cálculo: percorre todos os palpites de um jogo, calcula
 * pontos segundo as regras de cada bolão e atualiza os agregados.
 */
async function scoreMatch(matchId: string, homeScore: number, awayScore: number) {
  const predsSnap = await db
    .collection('predictions')
    .where('matchId', '==', matchId)
    .get();

  if (predsSnap.empty) {
    logger.info(`Nenhum palpite para o jogo ${matchId}.`);
    return;
  }

  // Cache das regras de cada bolão para não buscar repetido.
  const poolRules = new Map<string, ScoringRules>();
  async function rulesFor(poolId: string): Promise<ScoringRules | null> {
    if (poolRules.has(poolId)) return poolRules.get(poolId)!;
    const poolSnap = await db.doc(`pools/${poolId}`).get();
    const rules = poolSnap.data()?.settings?.scoring as ScoringRules | undefined;
    if (rules) poolRules.set(poolId, rules);
    return rules ?? null;
  }

  // Agregados a somar por membro (poolId_userId -> delta).
  const memberDeltas = new Map<
    string,
    { points: number; exact: number; winner: number }
  >();

  const batch = db.batch();

  for (const doc of predsSnap.docs) {
    const p = doc.data();
    const rules = await rulesFor(p.poolId);
    if (!rules) continue;

    const input = {
      predictedHome: p.predictedHome,
      predictedAway: p.predictedAway,
      actualHome: homeScore,
      actualAway: awayScore,
    };
    const points = calculatePoints(input, rules);
    const exact = isExactHit(input);
    const winner = points > 0;

    // Se já havia pontos atribuídos, calculamos só a diferença, para
    // o recálculo ser idempotente (rodar duas vezes não duplica).
    const previous = (p.pointsAwarded as number | null) ?? null;
    const wasExact = p.wasExact === true;
    const wasWinner = p.wasWinner === true;

    batch.update(doc.ref, {
      pointsAwarded: points,
      wasExact: exact,
      wasWinner: winner,
      scoredAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const key = `${p.poolId}_${p.userId}`;
    const delta = memberDeltas.get(key) ?? { points: 0, exact: 0, winner: 0 };
    delta.points += points - (previous ?? 0);
    delta.exact += (exact ? 1 : 0) - (wasExact ? 1 : 0);
    delta.winner += (winner ? 1 : 0) - (wasWinner ? 1 : 0);
    memberDeltas.set(key, delta);
  }

  // Aplica os deltas nos documentos de membro (ranking).
  for (const [memberId, delta] of memberDeltas.entries()) {
    batch.set(
      db.doc(`poolMembers/${memberId}`),
      {
        totalPoints: admin.firestore.FieldValue.increment(delta.points),
        exactHits: admin.firestore.FieldValue.increment(delta.exact),
        winnerHits: admin.firestore.FieldValue.increment(delta.winner),
      },
      { merge: true }
    );
  }

  await batch.commit();
  logger.info(
    `Jogo ${matchId}: ${predsSnap.size} palpites pontuados, ${memberDeltas.size} membros atualizados.`
  );
}
