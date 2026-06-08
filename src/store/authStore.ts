import { create } from 'zustand';
import { onAuthStateChanged, User } from 'firebase/auth';
import { firebaseAuth } from '@/services/firebase/config';
import { ensureUserProfile } from '@/services/firebase/auth';
import { UserProfile } from '@/types';

interface AuthState {
  /** true enquanto o app ainda não sabe se há sessão (mostra splash). */
  initializing: boolean;
  firebaseUser: User | null;
  profile: UserProfile | null;
  setProfile: (p: UserProfile | null) => void;
  /** Liga o "ouvinte" do Firebase. Chamado uma vez no layout raiz. */
  subscribe: () => () => void;
}

/**
 * Estado global leve de autenticação (Zustand, conforme PRD).
 * O resto do app só precisa ler `profile` para saber quem está logado.
 */
export const useAuthStore = create<AuthState>((set) => ({
  initializing: true,
  firebaseUser: null,
  profile: null,
  setProfile: (p) => set({ profile: p }),
  subscribe: () => {
    const unsub = onAuthStateChanged(firebaseAuth, async (user) => {
      if (user) {
        try {
          // ensureUserProfile cria o perfil caso ele não exista (auto-cura).
          const profile = await ensureUserProfile(user);
          set({ firebaseUser: user, profile, initializing: false });
        } catch {
          // Se o Firestore falhar (ex.: regras ainda não publicadas),
          // ao menos não deixa o app travado na tela de carregamento.
          set({ firebaseUser: user, profile: null, initializing: false });
        }
      } else {
        set({ firebaseUser: null, profile: null, initializing: false });
      }
    });
    return unsub;
  },
}));
