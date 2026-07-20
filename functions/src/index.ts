/**
 * Cloud Functions do Bolão da Copa.
 *
 * Fonte da verdade da pontuação: quando um jogo é finalizado (status
 * 'finished' com placar preenchido), recalculamos os pontos de TODOS os
 * palpites daquele jogo e atualizamos os agregados dos membros da edição.
 *
 * A função é idempotente:
 *  - se o resultado gravado não mudou, sai cedo;
 *  - ao recalcular, usa os valores previamente gravados no palpite
 *    (pointsAwarded/wasExact/wasWinner) para aplicar apenas o DELTA nos
 *    agregados via FieldValue.increment — então rodar de novo não duplica.
 */

import { initializeApp } from 'firebase-admin/app';
import {
  getFirestore,
  FieldValue,
  DocumentReference,
  WriteBatch,
} from 'firebase-admin/firestore';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';

import { scorePrediction, MatchResult } from './scoring';

// Inicializa o Admin SDK uma única vez.
initializeApp();
const db = getFirestore();

// Firestore aceita no máximo 500 operações por batch; deixamos folga.
const MAX_BATCH_OPS = 450;

interface MatchDoc {
  editionId?: string;
  status?: string;
  homeScore?: number | null;
  awayScore?: number | null;
  isKnockout?: boolean;
  decidedByPenalties?: boolean;
  penaltyWinnerTeamId?: string | null;
}

interface PredictionDoc {
  editionId?: string;
  userId?: string;
  matchId?: string;
  predictedHome?: number;
  predictedAway?: number;
  predictedPenaltyWinner?: string | null;
  pointsAwarded?: number | null;
  wasExact?: boolean | null;
  wasWinner?: boolean | null;
}

/** Uma operação de escrita a aplicar em batch. */
type WriteOp =
  | { kind: 'update'; ref: DocumentReference; data: Record<string, unknown> }
  | { kind: 'set-merge'; ref: DocumentReference; data: Record<string, unknown> };

/** Um jogo está "pontuável" quando finalizado e com placar preenchido. */
function isScorable(m: MatchDoc | undefined): m is MatchDoc {
  return (
    !!m &&
    m.status === 'finished' &&
    typeof m.homeScore === 'number' &&
    typeof m.awayScore === 'number'
  );
}

/** Compara os campos relevantes do resultado — usado para detectar no-op. */
function sameResult(a: MatchDoc, b: MatchDoc): boolean {
  return (
    a.status === b.status &&
    a.homeScore === b.homeScore &&
    a.awayScore === b.awayScore &&
    !!a.decidedByPenalties === !!b.decidedByPenalties &&
    (a.penaltyWinnerTeamId ?? null) === (b.penaltyWinnerTeamId ?? null)
  );
}

/** Aplica as operações em batches, respeitando o limite do Firestore. */
async function commitInBatches(ops: WriteOp[]): Promise<void> {
  for (let i = 0; i < ops.length; i += MAX_BATCH_OPS) {
    const batch: WriteBatch = db.batch();
    for (const op of ops.slice(i, i + MAX_BATCH_OPS)) {
      if (op.kind === 'update') {
        batch.update(op.ref, op.data);
      } else {
        batch.set(op.ref, op.data, { merge: true });
      }
    }
    await batch.commit();
  }
}

export const onMatchFinished = onDocumentWritten('matches/{matchId}', async (event) => {
  const matchId = event.params.matchId;
  const before = event.data?.before.exists ? (event.data.before.data() as MatchDoc) : undefined;
  const after = event.data?.after.exists ? (event.data.after.data() as MatchDoc) : undefined;

  // Documento removido ou sem resultado pontuável: nada a fazer.
  if (!isScorable(after)) {
    logger.debug('onMatchFinished: jogo não pontuável, ignorando', { matchId });
    return;
  }

  // Idempotência: se o jogo já estava finalizado com exatamente o mesmo
  // resultado, não há o que recalcular.
  if (isScorable(before) && sameResult(before, after)) {
    logger.debug('onMatchFinished: resultado inalterado, ignorando', { matchId });
    return;
  }

  const editionId = after.editionId;
  if (!editionId) {
    logger.error('onMatchFinished: jogo sem editionId', { matchId });
    return;
  }

  const result: MatchResult = {
    homeScore: after.homeScore as number,
    awayScore: after.awayScore as number,
    isKnockout: !!after.isKnockout,
    decidedByPenalties: after.decidedByPenalties,
    penaltyWinnerTeamId: after.penaltyWinnerTeamId ?? null,
  };

  const predsSnap = await db.collection('predictions').where('matchId', '==', matchId).get();

  if (predsSnap.empty) {
    logger.info('onMatchFinished: nenhum palpite para o jogo', { matchId, editionId });
    return;
  }

  // Delta acumulado por membro (há, no máximo, um palpite por usuário por
  // jogo, mas somamos por segurança).
  interface MemberDelta {
    points: number;
    exact: number;
    winner: number;
  }
  const memberDeltas = new Map<string, MemberDelta>();

  const ops: WriteOp[] = [];
  let processed = 0;

  for (const doc of predsSnap.docs) {
    const pred = doc.data() as PredictionDoc;

    if (typeof pred.predictedHome !== 'number' || typeof pred.predictedAway !== 'number') {
      logger.warn('onMatchFinished: palpite sem placar, ignorando', { predictionId: doc.id });
      continue;
    }
    const userId = pred.userId;
    if (!userId) {
      logger.warn('onMatchFinished: palpite sem userId, ignorando', { predictionId: doc.id });
      continue;
    }
    const predEditionId = pred.editionId ?? editionId;

    const breakdown = scorePrediction(
      {
        predictedHome: pred.predictedHome,
        predictedAway: pred.predictedAway,
        predictedPenaltyWinner: pred.predictedPenaltyWinner ?? null,
      },
      result,
    );

    // Valores anteriores (para idempotência ao recalcular).
    const prevPoints = typeof pred.pointsAwarded === 'number' ? pred.pointsAwarded : 0;
    const prevExact = pred.wasExact ? 1 : 0;
    const prevWinner = pred.wasWinner ? 1 : 0;

    const newPoints = breakdown.points;
    const newExact = breakdown.exactHit ? 1 : 0;
    const newWinner = breakdown.winnerHit ? 1 : 0;

    // Grava o resultado no próprio palpite.
    ops.push({
      kind: 'update',
      ref: doc.ref,
      data: {
        pointsAwarded: newPoints,
        wasExact: breakdown.exactHit,
        wasWinner: breakdown.winnerHit,
        scoredAt: FieldValue.serverTimestamp(),
      },
    });

    // Acumula o delta do membro.
    const memberId = `${predEditionId}_${userId}`;
    const md = memberDeltas.get(memberId) ?? { points: 0, exact: 0, winner: 0 };
    md.points += newPoints - prevPoints;
    md.exact += newExact - prevExact;
    md.winner += newWinner - prevWinner;
    memberDeltas.set(memberId, md);

    processed++;
  }

  // Increments nos membros (só quando há delta real).
  for (const [memberId, md] of memberDeltas) {
    if (md.points === 0 && md.exact === 0 && md.winner === 0) continue;
    ops.push({
      kind: 'set-merge',
      ref: db.collection('editionMembers').doc(memberId),
      data: {
        totalPoints: FieldValue.increment(md.points),
        exactHits: FieldValue.increment(md.exact),
        winnerHits: FieldValue.increment(md.winner),
      },
    });
  }

  await commitInBatches(ops);

  logger.info('onMatchFinished: pontuação aplicada', {
    matchId,
    editionId,
    predictions: processed,
    members: memberDeltas.size,
  });
});
