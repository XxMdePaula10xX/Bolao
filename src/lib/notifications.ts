import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { saveExpoPushToken } from '@/services/firebase/notifications';

/**
 * Configuração de como as notificações aparecem com o app aberto.
 * (Precisa ficar fora do componente, roda uma vez.)
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Pede permissão e registra o token de push do Expo.
 *
 * IMPORTANTE: no SDK 53+, notificações push REMOTAS não funcionam mais
 * no app Expo Go — só em "development build" ou no app publicado. Esta
 * função é tolerante a falhas: se não conseguir o token (ex.: rodando no
 * Expo Go), ela simplesmente retorna null sem quebrar o app.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Padrão',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#D4AF37',
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') return null;

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      // @ts-expect-error easConfig existe em runtime
      Constants.easConfig?.projectId;
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return token.data;
  } catch (e) {
    console.warn('[Push] Não foi possível obter o token (normal no Expo Go).', e);
    return null;
  }
}

/**
 * Hook que registra o token no login e o salva no perfil do usuário.
 * Use uma vez, na raiz, quando houver usuário logado.
 */
export function usePushRegistration(userId: string | undefined) {
  const done = useRef(false);
  useEffect(() => {
    if (!userId || done.current) return;
    done.current = true;
    registerForPushNotifications().then((token) => {
      if (token) saveExpoPushToken(userId, token).catch(() => {});
    });
  }, [userId]);
}

/**
 * Agenda uma notificação LOCAL (funciona até no Expo Go). Útil para
 * lembrar o usuário do prazo de palpite (seção 22 do PRD).
 */
export async function scheduleLocalReminder(
  title: string,
  body: string,
  date: Date
): Promise<void> {
  const seconds = Math.floor((date.getTime() - Date.now()) / 1000);
  if (seconds <= 0) return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
    },
  });
}
