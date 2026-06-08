import { QueryClient } from '@tanstack/react-query';

/**
 * Cliente único do TanStack Query. Cuida de cache, refetch e estados
 * de loading/erro das chamadas ao Firestore, evitando muito código
 * manual de "useState + useEffect" espalhado pelo app.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30s "fresco" antes de revalidar
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
