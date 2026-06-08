import {
  collection,
  doc,
  getDocs,
  query,
  where,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from './config';
import { Prediction, Match } from '@/types';
import { toDate } from '@/lib/utils';

/** Carrega todos os palpites de um usuário em um bolão. */
export async function listUserPredictions(
  poolId: string,
  userId: string
): Promise<Prediction[]> {
  const q = query(
    collection(db, 'predictions'),
    where('poolId', '==', poolId),
    where('userId', '==', userId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Prediction);
}

/** Carrega TODOS os palpites de um bolão (para mostrar palpites alheios
 *  respeitando a visibilidade — a regra fina é aplicada na UI). */
export async function listPoolPredictions(poolId: string): Promise<Prediction[]> {
  const q = query(collection(db, 'predictions'), where('poolId', '==', poolId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Prediction);
}

export interface DraftPrediction {
  matchId: string;
  predictedHome: number;
  predictedAway: number;
}

/**
 * Salva um lote de palpites (envio por rodada, seção 6.6).
 * Só permite salvar palpites de jogos que ainda não começaram —
 * essa é uma regra de negócio obrigatória (seção 10). As Firestore
 * Rules reforçam isso no servidor; aqui filtramos antes de enviar.
 */
export async function submitPredictions(
  poolId: string,
  userId: string,
  drafts: DraftPrediction[],
  matchesById: Record<string, Match>
): Promise<{ saved: number; skipped: number }> {
  const batch = writeBatch(db);
  let saved = 0;
  let skipped = 0;
  const now = Date.now();

  for (const draft of drafts) {
    const match = matchesById[draft.matchId];
    const start = toDate(match?.startTime)?.getTime() ?? 0;
    const locked = match?.status !== 'scheduled' || (start > 0 && start <= now);

    if (locked) {
      skipped++;
      continue;
    }
    if (draft.predictedHome == null || draft.predictedAway == null) {
      skipped++;
      continue;
    }

    const id = `${poolId}_${userId}_${draft.matchId}`;
    const prediction: Prediction = {
      id,
      poolId,
      userId,
      matchId: draft.matchId,
      predictedHome: draft.predictedHome,
      predictedAway: draft.predictedAway,
      predictedQualifiedTeamId: null,
      submittedAt: serverTimestamp() as never,
      pointsAwarded: null,
    };
    batch.set(doc(db, 'predictions', id), prediction, { merge: true });
    saved++;
  }

  if (saved > 0) await batch.commit();
  return { saved, skipped };
}
