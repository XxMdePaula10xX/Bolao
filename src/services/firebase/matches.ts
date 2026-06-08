import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from './config';
import { Competition, Match } from '@/types';

/** Catálogo de competições reais cadastradas pelo admin (RF-04). */
export async function listCompetitions(): Promise<Competition[]> {
  const snap = await getDocs(collection(db, 'competitions'));
  return snap.docs.map((d) => d.data() as Competition);
}

export async function getCompetition(id: string): Promise<Competition | null> {
  const snap = await getDoc(doc(db, 'competitions', id));
  return snap.exists() ? (snap.data() as Competition) : null;
}

/** Jogos de uma competição, ordenados por data (seção 6.6). */
export async function listMatches(competitionId: string): Promise<Match[]> {
  const q = query(
    collection(db, 'matches'),
    where('competitionId', '==', competitionId),
    orderBy('startTime', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Match);
}

/**
 * Assina os jogos de uma competição EM TEMPO REAL (seção 23 do PRD).
 * Sempre que a Cloud Function atualizar um placar/status no Firestore,
 * o callback é chamado de novo — o app reflete o "ao vivo" sozinho.
 * Devolve uma função para cancelar a assinatura.
 */
export function subscribeMatches(
  competitionId: string,
  onUpdate: (matches: Match[]) => void,
  onError?: (e: Error) => void
): () => void {
  const q = query(
    collection(db, 'matches'),
    where('competitionId', '==', competitionId),
    orderBy('startTime', 'asc')
  );
  return onSnapshot(
    q,
    (snap) => onUpdate(snap.docs.map((d) => d.data() as Match)),
    (err) => onError?.(err)
  );
}
