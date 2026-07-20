import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { getEdition } from '@/services/editions';
import type { LongTermPrediction, UserProfile } from '@/types';

/** Lê os palpites de longo prazo (mercados) de um usuário numa edição. */
export async function getLongTerm(
  editionId: string,
  uid: string,
): Promise<LongTermPrediction | null> {
  const snap = await getDoc(doc(db, 'longTermPredictions', `${editionId}_${uid}`));
  return snap.exists() ? (snap.data() as LongTermPrediction) : null;
}

/** Lê os palpites de longo prazo de TODOS os participantes da edição. */
export async function listLongTerm(editionId: string): Promise<LongTermPrediction[]> {
  const snap = await getDocs(
    query(collection(db, 'longTermPredictions'), where('editionId', '==', editionId)),
  );
  return snap.docs.map((d) => d.data() as LongTermPrediction);
}

/**
 * Salva (merge) os palpites de longo prazo do usuário.
 * id = `${editionId}_${userId}`.
 */
export async function saveLongTerm(
  editionId: string,
  user: UserProfile,
  input: {
    championTeam?: string | null;
    topScorer?: string | null;
    assistLeader?: string | null;
    bestPlayer?: string | null;
  },
): Promise<void> {
  // Janela de longo prazo: só é editável em 'draft' ou 'longterm_open'.
  // Após "Iniciar a Copa" ('running') ou 'finished', os palpites travam.
  const edition = await getEdition(editionId);
  if (edition && (edition.status === 'running' || edition.status === 'finished')) {
    throw new Error('A janela de palpites de longo prazo já foi encerrada.');
  }

  const id = `${editionId}_${user.id}`;
  const payload: LongTermPrediction = {
    id,
    editionId,
    userId: user.id,
    championTeam: input.championTeam ?? null,
    topScorer: input.topScorer ?? null,
    assistLeader: input.assistLeader ?? null,
    bestPlayer: input.bestPlayer ?? null,
    submittedAt: null,
  };
  await setDoc(
    doc(db, 'longTermPredictions', id),
    { ...payload, submittedAt: serverTimestamp() },
    { merge: true },
  );
}
