import { create } from 'zustand';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/services/firebase';
import { ensureProfile } from '@/services/auth';
import type { UserProfile } from '@/types';

interface AuthState {
  initializing: boolean;
  user: User | null;
  profile: UserProfile | null;
  setProfile: (p: UserProfile | null) => void;
  subscribe: () => () => void;
}

/** Estado global de autenticação (Zustand). */
export const useAuthStore = create<AuthState>((set) => ({
  initializing: true,
  user: null,
  profile: null,
  setProfile: (p) => set({ profile: p }),
  subscribe: () =>
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const profile = await ensureProfile(user);
          set({ user, profile, initializing: false });
        } catch {
          set({ user, profile: null, initializing: false });
        }
      } else {
        set({ user: null, profile: null, initializing: false });
      }
    }),
}));
