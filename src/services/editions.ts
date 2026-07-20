import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { generateInviteCode } from '@/lib/invite';
import type {
  Edition,
  EditionMember,
  EditionPrizes,
  EditionSettings,
  EditionStatus,
  UserProfile,
} from '@/types';

/** Premiação padrão quando o organizador não define valores. */
const DEFAULT_PRIZES: EditionPrizes = {
  ranking: { first: 0, second: 0, third: 0 },
  league: { first: 0, second: 0, third: 0 },
  cup: { total: 0 },
  longTerm: { perMarket: 0 },
};

/**
 * Cria uma edição e o EditionMember do organizador em UM writeBatch.
 * O organizador entra como 'organizer' com agregados zerados.
 */
export async function createEdition(
  owner: UserProfile,
  input: {
    name: string;
    competitionName?: string;
    prizes?: EditionPrizes;
    settings?: EditionSettings;
  },
): Promise<Edition> {
  const editionRef = doc(collection(db, 'editions'));
  const inviteCode = generateInviteCode();
  const prizes = input.prizes ?? DEFAULT_PRIZES;

  const edition: Edition = {
    id: editionRef.id,
    name: input.name,
    competitionId: '',
    competitionName: input.competitionName,
    status: 'draft',
    inviteCode,
    prizes,
    ...(input.settings ? { settings: input.settings } : {}),
    memberCount: 1,
    ownerId: owner.id,
    createdAt: null,
  };

  const memberId = `${editionRef.id}_${owner.id}`;
  const memberRef = doc(db, 'editionMembers', memberId);
  const member: EditionMember = {
    id: memberId,
    editionId: editionRef.id,
    userId: owner.id,
    nickname: owner.nickname,
    avatarUrl: owner.avatarUrl ?? null,
    role: 'organizer',
    joinedAt: null,
    totalPoints: 0,
    exactHits: 0,
    winnerHits: 0,
  };

  const batch = writeBatch(db);
  batch.set(editionRef, { ...edition, createdAt: serverTimestamp() });
  batch.set(memberRef, { ...member, joinedAt: serverTimestamp() });
  await batch.commit();

  return edition;
}

export async function getEdition(id: string): Promise<Edition | null> {
  const snap = await getDoc(doc(db, 'editions', id));
  return snap.exists() ? (snap.data() as Edition) : null;
}

/** Lista as edições em que o usuário participa (ordenadas por criação desc). */
export async function listMyEditions(uid: string): Promise<Edition[]> {
  const membersSnap = await getDocs(
    query(collection(db, 'editionMembers'), where('userId', '==', uid)),
  );
  const editionIds = membersSnap.docs.map((d) => (d.data() as EditionMember).editionId);
  if (editionIds.length === 0) return [];

  const editions = await Promise.all(editionIds.map((id) => getEdition(id)));
  return editions
    .filter((e): e is Edition => e !== null)
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
}

export async function findEditionByInvite(code: string): Promise<Edition | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  const snap = await getDocs(
    query(collection(db, 'editions'), where('inviteCode', '==', normalized)),
  );
  if (snap.empty) return null;
  return snap.docs[0].data() as Edition;
}

/**
 * Adiciona o usuário como 'participant' e incrementa SOMENTE o memberCount
 * da edição, em batch. Não faz nada se já for membro.
 */
export async function joinEdition(edition: Edition, user: UserProfile): Promise<void> {
  const memberId = `${edition.id}_${user.id}`;
  const memberRef = doc(db, 'editionMembers', memberId);
  const existing = await getDoc(memberRef);
  if (existing.exists()) return;

  const member: EditionMember = {
    id: memberId,
    editionId: edition.id,
    userId: user.id,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl ?? null,
    role: 'participant',
    joinedAt: null,
    totalPoints: 0,
    exactHits: 0,
    winnerHits: 0,
  };

  const batch = writeBatch(db);
  batch.set(memberRef, { ...member, joinedAt: serverTimestamp() });
  batch.update(doc(db, 'editions', edition.id), { memberCount: increment(1) });
  await batch.commit();
}

/** Lista membros de uma edição, ordenados por totalPoints desc. */
export async function listEditionMembers(editionId: string): Promise<EditionMember[]> {
  const snap = await getDocs(
    query(collection(db, 'editionMembers'), where('editionId', '==', editionId)),
  );
  return snap.docs
    .map((d) => d.data() as EditionMember)
    .sort((a, b) => b.totalPoints - a.totalPoints);
}

/**
 * Atualiza o status do ciclo da edição
 * ('draft' → 'longterm_open' → 'running' → 'finished').
 * Só o organizador (regras) consegue gravar.
 */
export async function setEditionStatus(
  editionId: string,
  status: EditionStatus,
): Promise<void> {
  await updateDoc(doc(db, 'editions', editionId), { status });
}

export function isOrganizer(edition: Edition, uid: string): boolean {
  return edition.ownerId === uid;
}

function toMillis(value: Edition['createdAt']): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  // Timestamp
  return value.toMillis();
}
