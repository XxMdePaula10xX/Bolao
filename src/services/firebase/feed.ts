import {
  collection,
  doc,
  getDocs,
  query,
  where,
  limit,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from './config';
import { FeedPost, UserProfile } from '@/types';
import { toDate } from '@/lib/utils';

/** Lista os posts do mural de um bolão, mais recentes primeiro.
 *  A ordenação é feita no app para não exigir índice composto. */
export async function listFeed(poolId: string): Promise<FeedPost[]> {
  const q = query(collection(db, 'feedPosts'), where('poolId', '==', poolId), limit(50));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => d.data() as FeedPost)
    .sort((a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0));
}

/** Cria um post no mural (apenas o organizador, garantido pelas rules). */
export async function createFeedPost(
  poolId: string,
  author: UserProfile,
  text: string
): Promise<void> {
  const ref = doc(collection(db, 'feedPosts'));
  const post: FeedPost = {
    id: ref.id,
    poolId,
    authorId: author.id,
    authorName: author.name,
    type: 'post',
    text: text.trim(),
    createdAt: serverTimestamp() as never,
  };
  await setDoc(ref, post);
}
