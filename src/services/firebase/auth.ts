import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { firebaseAuth, db } from './config';
import { UserProfile } from '@/types';

/** Cadastro com e-mail/senha + criação do perfil no Firestore (RF-01). */
export async function registerWithEmail(
  name: string,
  email: string,
  password: string
): Promise<User> {
  const cred = await createUserWithEmailAndPassword(firebaseAuth, email, password);
  await updateProfile(cred.user, { displayName: name });

  const profile: Omit<UserProfile, 'createdAt'> & { createdAt: unknown } = {
    id: cred.user.uid,
    name,
    email,
    avatarUrl: null,
    createdAt: serverTimestamp(),
    isSystemAdmin: false,
    stats: { poolsCreated: 0, poolsJoined: 0, totalPoints: 0 },
  };
  await setDoc(doc(db, 'users', cred.user.uid), profile);
  return cred.user;
}

/** Login com e-mail/senha (RF-01). */
export async function loginWithEmail(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(firebaseAuth, email, password);
  return cred.user;
}

export async function logout(): Promise<void> {
  await signOut(firebaseAuth);
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(firebaseAuth, email);
}

/** Busca o documento de perfil do usuário no Firestore. */
export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

/**
 * Garante que o usuário autenticado tenha um documento de perfil.
 * Se o perfil não existir (ex.: o cadastro foi feito antes de as regras
 * do Firestore serem publicadas, então a gravação falhou), cria um
 * perfil mínimo a partir dos dados da conta. Isso "auto-cura" contas
 * que ficaram sem perfil e evita o login em looping.
 */
export async function ensureUserProfile(user: User): Promise<UserProfile> {
  const existing = await fetchUserProfile(user.uid);
  if (existing) return existing;

  const profile: Omit<UserProfile, 'createdAt'> & { createdAt: unknown } = {
    id: user.uid,
    name: user.displayName ?? user.email?.split('@')[0] ?? 'Palpiteiro',
    email: user.email ?? '',
    avatarUrl: null,
    createdAt: serverTimestamp(),
    isSystemAdmin: false,
    stats: { poolsCreated: 0, poolsJoined: 0, totalPoints: 0 },
  };
  await setDoc(doc(db, 'users', user.uid), profile, { merge: true });
  return (await fetchUserProfile(user.uid)) ?? (profile as UserProfile);
}

/**
 * Traduz códigos de erro do Firebase Auth para mensagens em português.
 * Sem isso, o usuário veria algo como "auth/invalid-credential".
 */
export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-email': 'E-mail inválido.',
    'auth/user-disabled': 'Esta conta foi desativada.',
    'auth/user-not-found': 'Conta não encontrada.',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
    'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
    'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.',
    'auth/network-request-failed': 'Falha de conexão. Verifique sua internet.',
  };
  return map[code] ?? 'Algo deu errado. Tente novamente.';
}
