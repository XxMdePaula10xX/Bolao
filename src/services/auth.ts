import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { UserProfile } from '@/types';

/** Cadastro por e-mail/senha + criação do perfil (apelido) — RF-01. */
export async function register(nickname: string, email: string, password: string): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: nickname });
  await setDoc(
    doc(db, 'users', cred.user.uid),
    { id: cred.user.uid, nickname, email, avatarUrl: null, isSystemAdmin: false, createdAt: serverTimestamp() },
    { merge: true },
  );
  return cred.user;
}

export async function login(email: string, password: string): Promise<User> {
  return (await signInWithEmailAndPassword(auth, email, password)).user;
}

export async function logout(): Promise<void> {
  await signOut(auth);
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

/** Garante o documento de perfil (auto-cura contas sem perfil). */
export async function ensureProfile(user: User): Promise<UserProfile> {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data() as UserProfile;
  const profile = {
    id: user.uid,
    nickname: user.displayName || user.email?.split('@')[0] || 'Palpiteiro',
    email: user.email || '',
    avatarUrl: null,
    isSystemAdmin: false,
    createdAt: serverTimestamp(),
  };
  await setDoc(ref, profile, { merge: true });
  return (await getDoc(ref)).data() as UserProfile;
}

export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-email': 'E-mail inválido.',
    'auth/user-not-found': 'Conta não encontrada.',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
    'auth/weak-password': 'A senha precisa ter ao menos 6 caracteres.',
    'auth/too-many-requests': 'Muitas tentativas. Tente mais tarde.',
    'auth/network-request-failed': 'Falha de conexão. Verifique sua internet.',
  };
  return map[code] ?? 'Algo deu errado. Tente novamente.';
}
