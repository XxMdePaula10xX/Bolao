import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { LongTermPrediction, UserProfile } from '@/types';

/** Lê os palpites de longo prazo (mercados) de um usuário numa edição. */
export async function getLongTerm(
  editionId: string,
  uid: string,
): Promise<LongTermPrediction | null> {
  const snap = await getDoc(doc(db, 'longTermPredictions', `${editionId}_${uid}`));
  return snap.exists() ? (snap.data() as LongTermPrediction) : null;
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
