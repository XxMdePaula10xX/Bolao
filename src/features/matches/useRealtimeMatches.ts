import { useEffect, useState } from 'react';
import { subscribeMatches } from '@/services/firebase/matches';
import { Match } from '@/types';

interface State {
  matches: Match[];
  loading: boolean;
  error: string | null;
}

/**
 * Hook que mantém os jogos de uma competição atualizados em tempo real.
 * Enquanto a Cloud Function sincroniza a API esportiva no Firestore,
 * a tela recebe os novos placares automaticamente, sem precisar dar
 * "puxar para atualizar".
 */
export function useRealtimeMatches(competitionId: string | undefined): State {
  const [state, setState] = useState<State>({ matches: [], loading: true, error: null });

  useEffect(() => {
    if (!competitionId) {
      setState({ matches: [], loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    const unsub = subscribeMatches(
      competitionId,
      (matches) => setState({ matches, loading: false, error: null }),
      (err) => setState({ matches: [], loading: false, error: err.message })
    );
    return unsub;
  }, [competitionId]);

  return state;
}
