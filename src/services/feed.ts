/**
 * SERVIÇO DO FEED (mural da edição).
 *
 * Só o organizador da edição posta (garantido pelas regras do Firestore);
 * qualquer membro lê. Documentos na coleção `feedPosts`.
 */
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { FeedPost, UserProfile } from '@/types';

function toMillis(value: FeedPost['createdAt']): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  return value.toMillis();
}

/** Lista os posts do feed de uma edição, do mais recente para o mais antigo. */
export async function listFeed(editionId: string): Promise<FeedPost[]> {
  const snap = await getDocs(
    query(collection(db, 'feedPosts'), where('editionId', '==', editionId)),
  );
  return snap.docs
    .map((d) => d.data() as FeedPost)
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
}

/** Publica um post no feed da edição (autor = organizador). */
export async function postFeed(
  editionId: string,
  author: UserProfile,
  text: string,
): Promise<void> {
  const ref = doc(collection(db, 'feedPosts'));
  const post: FeedPost = {
    id: ref.id,
    editionId,
    authorId: author.id,
    authorName: author.nickname,
    text,
    createdAt: null,
  };
  await setDoc(ref, { ...post, createdAt: serverTimestamp() });
}
