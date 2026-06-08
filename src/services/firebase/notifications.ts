import {
  collection,
  doc,
  getDocs,
  query,
  where,
  limit,
  updateDoc,
} from 'firebase/firestore';
import { db } from './config';
import { AppNotification } from '@/types';
import { toDate } from '@/lib/utils';

/** Salva o token de push do Expo no perfil do usuário. */
export async function saveExpoPushToken(userId: string, token: string): Promise<void> {
  await updateDoc(doc(db, 'users', userId), { expoPushToken: token });
}

/** Lista as notificações in-app do usuário (mais recentes primeiro).
 *  Ordenação feita no app para não exigir índice composto. */
export async function listNotifications(userId: string): Promise<AppNotification[]> {
  const q = query(collection(db, 'notifications'), where('userId', '==', userId), limit(50));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => d.data() as AppNotification)
    .sort((a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0));
}

export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(doc(db, 'notifications', id), { read: true });
}
