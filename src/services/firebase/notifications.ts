import {
  collection,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
} from 'firebase/firestore';
import { db } from './config';
import { AppNotification } from '@/types';

/** Salva o token de push do Expo no perfil do usuário. */
export async function saveExpoPushToken(userId: string, token: string): Promise<void> {
  await updateDoc(doc(db, 'users', userId), { expoPushToken: token });
}

/** Lista as notificações in-app do usuário (mais recentes primeiro). */
export async function listNotifications(userId: string): Promise<AppNotification[]> {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as AppNotification);
}

export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(doc(db, 'notifications', id), { read: true });
}
