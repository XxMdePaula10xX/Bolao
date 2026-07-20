import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { fireToMillis } from '@/lib/date';
import type { Match, Prediction } from '@/types';

/** Lista os palpites de um usuário numa edição. */
export async function listUserPredictions(
  editionId: string,
  uid: string,
): Promise<Prediction[]> {
  const snap = await getDocs(
    query(
      collection(db, 'predictions'),
      where('editionId', '==', editionId),
      where('userId', '==', uid),
    ),
  );
  return snap.docs.map((d) => d.data() as Prediction);
}

/** Um jogo aceita palpite enquanto está 'scheduled' e ainda não começou. */
function isLocked(match: Match | undefined, now: number): boolean {
  if (!match) return true;
  if (match.status !== 'scheduled') return true;
  return fireToMillis(match.startTime) <= now;
}

/**
 * Grava vários palpites em batch (merge). Ignora jogos travados
 * (status !== 'scheduled' OU já começaram). Retorna quantos foram salvos
 * e quantos foram pulados.
 */
export async function submitPredictions(
  editionId: string,
  uid: string,
  drafts: {
    matchId: string;
    predictedHome: number;
    predictedAway: number;
    predictedPenaltyWinner?: string | null;
  }[],
  matchesById: Record<string, Match>,
): Promise<{ saved: number; skipped: number }> {
  const now = Date.now();
  const batch = writeBatch(db);
  let saved = 0;
  let skipped = 0;

  for (const draft of drafts) {
    const match = matchesById[draft.matchId];
    if (isLocked(match, now)) {
      skipped++;
      continue;
    }

    const id = `${editionId}_${uid}_${draft.matchId}`;
    const prediction: Prediction = {
      id,
      editionId,
      userId: uid,
      matchId: draft.matchId,
      predictedHome: draft.predictedHome,
      predictedAway: draft.predictedAway,
      predictedPenaltyWinner: draft.predictedPenaltyWinner ?? null,
      submittedAt: null,
    };
    batch.set(
      doc(db, 'predictions', id),
      { ...prediction, submittedAt: serverTimestamp() },
      { merge: true },
    );
    saved++;
  }

  if (saved > 0) await batch.commit();
  return { saved, skipped };
}
