import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/authStore';

/**
 * Rota inicial. Manda o usuário para a home (logado) ou para o
 * login. O layout raiz também faz essa guarda, mas isto garante
 * que "/" nunca fique numa tela em branco.
 */
export default function Index() {
  const { profile } = useAuthStore();
  return <Redirect href={profile ? '/(app)/home' : '/(auth)/login'} />;
}
