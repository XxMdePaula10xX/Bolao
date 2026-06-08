import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
  serverTimestamp,
  writeBatch,
  increment,
} from 'firebase/firestore';
import { db } from './config';
import { Pool, PoolMember, PoolSettings, UserProfile } from '@/types';
import { slugify, generateInviteCode, toDate } from '@/lib/utils';

const poolsCol = collection(db, 'pools');

export interface CreatePoolInput {
  name: string;
  description?: string;
  isPublic: boolean;
  competitionId: string;
  competitionName?: string;
  settings: PoolSettings;
  prize?: string;
  maxParticipants?: number | null;
}

/**
 * Cria um bolão (RF-02) e já adiciona o criador como membro "owner"
 * em uma única operação atômica (batch). Assim nunca fica um bolão
 * sem dono no banco.
 */
export async function createPool(
  owner: UserProfile,
  input: CreatePoolInput
): Promise<Pool> {
  const poolRef = doc(poolsCol);
  const inviteCode = generateInviteCode();
  const slug = `${slugify(input.name)}-${inviteCode.toLowerCase()}`;

  const pool: Pool = {
    id: poolRef.id,
    ownerId: owner.id,
    name: input.name,
    slug,
    description: input.description ?? '',
    isPublic: input.isPublic,
    inviteCode,
    coverImageUrl: null,
    competitionId: input.competitionId,
    competitionName: input.competitionName ?? '',
    status: 'open',
    rulesVersion: 1,
    settings: input.settings,
    prize: input.prize ?? '',
    maxParticipants: input.maxParticipants ?? null,
    memberCount: 1,
    createdByAdmin: !!owner.isSystemAdmin,
    createdAt: serverTimestamp() as never,
  };

  const memberRef = doc(db, 'poolMembers', `${poolRef.id}_${owner.id}`);
  const member: PoolMember = {
    id: `${poolRef.id}_${owner.id}`,
    poolId: poolRef.id,
    userId: owner.id,
    userName: owner.name,
    userAvatarUrl: owner.avatarUrl ?? null,
    role: 'owner',
    status: 'active',
    joinedAt: serverTimestamp() as never,
    totalPoints: 0,
    exactHits: 0,
    winnerHits: 0,
  };

  const batch = writeBatch(db);
  batch.set(poolRef, pool);
  batch.set(memberRef, member);
  // set+merge em vez de update: não falha se o doc do usuário ainda
  // não tiver o campo stats.
  batch.set(
    doc(db, 'users', owner.id),
    { stats: { poolsCreated: increment(1) } },
    { merge: true }
  );
  await batch.commit();

  return pool;
}

export async function getPool(poolId: string): Promise<Pool | null> {
  const snap = await getDoc(doc(db, 'pools', poolId));
  return snap.exists() ? (snap.data() as Pool) : null;
}

/** Ordena bolões do mais novo para o mais antigo (feito no app). */
function sortByCreatedDesc(pools: Pool[]): Pool[] {
  return pools.sort(
    (a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0)
  );
}

/** Bolões públicos para a aba Explorar (RF-10 / seção 6.2). */
export async function listPublicPools(): Promise<Pool[]> {
  const q = query(poolsCol, where('isPublic', '==', true), limit(50));
  const snap = await getDocs(q);
  return sortByCreatedDesc(snap.docs.map((d) => d.data() as Pool));
}

/** Bolões oficiais criados pelo admin do sistema. */
export async function listOfficialPools(): Promise<Pool[]> {
  const q = query(poolsCol, where('createdByAdmin', '==', true), limit(20));
  const snap = await getDocs(q);
  return sortByCreatedDesc(snap.docs.map((d) => d.data() as Pool));
}

/** Bolões em que o usuário participa (aba Meus Bolões). */
export async function listMyPools(userId: string): Promise<Pool[]> {
  const membershipsQ = query(
    collection(db, 'poolMembers'),
    where('userId', '==', userId),
    where('status', '==', 'active')
  );
  const memberSnap = await getDocs(membershipsQ);
  const poolIds = memberSnap.docs.map((d) => (d.data() as PoolMember).poolId);
  if (poolIds.length === 0) return [];

  // Busca cada bolão por ID (em paralelo). Simples e à prova de
  // problemas de índice; o usuário costuma estar em poucos bolões.
  const results = await Promise.all(poolIds.map((id) => getDoc(doc(db, 'pools', id))));
  return results.filter((s) => s.exists()).map((s) => s.data() as Pool);
}

export async function findPoolByInviteCode(code: string): Promise<Pool | null> {
  const q = query(poolsCol, where('inviteCode', '==', code.toUpperCase()), limit(1));
  const snap = await getDocs(q);
  return snap.empty ? null : (snap.docs[0].data() as Pool);
}

/** Entra em um bolão (fluxo de participação, seção 9.2). */
export async function joinPool(pool: Pool, user: UserProfile): Promise<void> {
  const memberRef = doc(db, 'poolMembers', `${pool.id}_${user.id}`);
  const existing = await getDoc(memberRef);
  if (existing.exists() && (existing.data() as PoolMember).status === 'active') {
    return; // já é membro
  }

  const member: PoolMember = {
    id: `${pool.id}_${user.id}`,
    poolId: pool.id,
    userId: user.id,
    userName: user.name,
    userAvatarUrl: user.avatarUrl ?? null,
    role: 'member',
    status: 'active',
    joinedAt: serverTimestamp() as never,
    totalPoints: 0,
    exactHits: 0,
    winnerHits: 0,
  };

  const batch = writeBatch(db);
  batch.set(memberRef, member);
  // Só o campo memberCount muda no bolão (as regras permitem isso a
  // qualquer membro entrando; ver firestore.rules).
  batch.update(doc(db, 'pools', pool.id), { memberCount: increment(1) });
  batch.set(
    doc(db, 'users', user.id),
    { stats: { poolsJoined: increment(1) } },
    { merge: true }
  );
  await batch.commit();
}

/** Lista de participantes de um bolão, ordenada por pontos (ranking). */
export async function listPoolMembers(poolId: string): Promise<PoolMember[]> {
  const q = query(
    collection(db, 'poolMembers'),
    where('poolId', '==', poolId),
    where('status', '==', 'active')
  );
  const snap = await getDocs(q);
  const members = snap.docs.map((d) => d.data() as PoolMember);
  return members.sort((a, b) => b.totalPoints - a.totalPoints);
}
