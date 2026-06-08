import {
  collection,
  doc,
  getDoc,
  getDocs,
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
