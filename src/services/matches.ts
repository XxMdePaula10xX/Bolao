import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { fireToMillis } from '@/lib/date';
import type { Match, Team } from '@/types';

/** Slug simples e estável a partir do nome do time (usado como Team.id). */
function slug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function makeTeam(name: string, flag?: string): Team {
  return { id: slug(name), name, flag: flag ?? null };
}

function sortByStartTime(a: Match, b: Match): number {
  return fireToMillis(a.startTime) - fireToMillis(b.startTime);
}

/** Lista jogos de uma edição, ordenados por startTime asc. */
export async function listMatches(editionId: string): Promise<Match[]> {
  const snap = await getDocs(
    query(collection(db, 'matches'), where('editionId', '==', editionId)),
  );
  return snap.docs.map((d) => d.data() as Match).sort(sortByStartTime);
}

/** Assina jogos em tempo real (ordenados por startTime asc no cliente). */
export function subscribeMatches(
  editionId: string,
  cb: (m: Match[]) => void,
  onErr?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(db, 'matches'), where('editionId', '==', editionId)),
    (snap) => {
      const matches = snap.docs.map((d) => d.data() as Match).sort(sortByStartTime);
      cb(matches);
    },
    (err) => onErr?.(err),
  );
}

export async function addMatch(
  editionId: string,
  input: {
    homeName: string;
    homeFlag?: string;
    awayName: string;
    awayFlag?: string;
    startTime: Date;
    isKnockout: boolean;
    stage?: string;
    round?: number;
  },
): Promise<void> {
  const ref = doc(collection(db, 'matches'));
  const match: Match = {
    id: ref.id,
    editionId,
    homeTeam: makeTeam(input.homeName, input.homeFlag),
    awayTeam: makeTeam(input.awayName, input.awayFlag),
    startTime: Timestamp.fromDate(input.startTime),
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
    stage: input.stage,
    round: input.round ?? null,
    isKnockout: input.isKnockout,
  };
  await setDoc(ref, { ...match, createdAt: serverTimestamp() });
}

export async function setMatchResult(
  matchId: string,
  r: {
    homeScore: number;
    awayScore: number;
    decidedByPenalties?: boolean;
    penaltyWinnerTeamId?: string | null;
  },
  finished: boolean,
): Promise<void> {
  await setDoc(
    doc(db, 'matches', matchId),
    {
      homeScore: r.homeScore,
      awayScore: r.awayScore,
      status: finished ? 'finished' : 'live',
      decidedByPenalties: r.decidedByPenalties ?? false,
      penaltyWinnerTeamId: r.penaltyWinnerTeamId ?? null,
      lastSyncedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
