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
import {
  onDocumentWritten,
  onDocumentCreated,
} from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { db, admin } from './firebaseAdmin';
import { calculatePoints, isExactHit, ScoringRules } from './scoring';

// As funções de sincronização com a API esportiva ficam em ./sync.
export {
  syncCompetitionNow,
  scheduledSyncMatches,
} from './sync';

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

// ===========================================================================
// NOTIFICAÇÕES
// ===========================================================================

/**
 * Quando um aviso é publicado no feed de um bolão, notificamos todos os
 * membros: criamos uma notificação in-app e enviamos um push (Expo).
 *
 * OBS: push remoto só chega em "development build" ou no app publicado —
 * no Expo Go (SDK 53+) ele não funciona, mas a notificação in-app sim.
 */
export const onFeedPostCreated = onDocumentCreated('feedPosts/{postId}', async (event) => {
  const post = event.data?.data();
  if (!post) return;

  const poolSnap = await db.doc(`pools/${post.poolId}`).get();
  const poolName = poolSnap.data()?.name ?? 'seu bolão';

  // Busca os membros ativos do bolão.
  const membersSnap = await db
    .collection('poolMembers')
    .where('poolId', '==', post.poolId)
    .where('status', '==', 'active')
    .get();

  const title = `📢 ${poolName}`;
  const body = post.text?.slice(0, 140) ?? 'Novo aviso no bolão';

  const batch = db.batch();
  const pushTokens: string[] = [];

  for (const memberDoc of membersSnap.docs) {
    const userId = memberDoc.data().userId as string;
    if (userId === post.authorId) continue; // não notifica o autor

    // Notificação in-app
    const notifRef = db.collection('notifications').doc();
    batch.set(notifRef, {
      id: notifRef.id,
      userId,
      type: 'feed_post',
      title,
      body,
      read: false,
      poolId: post.poolId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Token de push do usuário
    const userSnap = await db.doc(`users/${userId}`).get();
    const token = userSnap.data()?.expoPushToken as string | undefined;
    if (token) pushTokens.push(token);
  }

  await batch.commit();
  await sendExpoPush(pushTokens, title, body, { poolId: post.poolId });
  logger.info(`Feed ${post.poolId}: ${membersSnap.size} membros notificados.`);
});

/**
 * Envia notificações push pela API do Expo. Aceita uma lista de tokens
 * e quebra em lotes de 100 (limite recomendado pela Expo).
 */
async function sendExpoPush(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, unknown> = {}
): Promise<void> {
  const valid = tokens.filter((t) => t && t.startsWith('ExponentPushToken'));
  if (valid.length === 0) return;

  for (let i = 0; i < valid.length; i += 100) {
    const chunk = valid.slice(i, i + 100);
    const messages = chunk.map((to) => ({ to, sound: 'default', title, body, data }));
    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });
    } catch (e) {
      logger.error('Falha ao enviar push', e);
    }
  }
}
