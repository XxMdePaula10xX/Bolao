import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { View } from 'react-native';
import { queryClient } from '@/services/queryClient';
import { useAuthStore } from '@/store/authStore';
import { usePushRegistration } from '@/lib/notifications';
import { Loading } from '@/components/ui';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Guarda de rotas: redireciona para login se não estiver logado,
 * e para a home se já estiver. É o "porteiro" do app.
 */
function useAuthGuard() {
  const { initializing, profile } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (initializing) return;
    const inAuthGroup = segments[0] === '(auth)';

    if (!profile && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (profile && inAuthGroup) {
      router.replace('/(app)/home');
    }
  }, [initializing, profile, segments]);
}

function RootNavigator() {
  const { initializing, subscribe, profile } = useAuthStore();

  useEffect(() => {
    const unsub = subscribe();
    return unsub;
  }, []);

  // Registra o token de push assim que houver um usuário logado.
  usePushRegistration(profile?.id);

  useEffect(() => {
    if (!initializing) SplashScreen.hideAsync().catch(() => {});
  }, [initializing]);

  useAuthGuard();

  if (initializing) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Loading label="Carregando Bolão Flex..." />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
      <Stack.Screen
        name="create-pool"
        options={{ presentation: 'modal', headerShown: false }}
      />
      <Stack.Screen name="join" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen
        name="notifications"
        options={{ presentation: 'modal', headerShown: false }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <RootNavigator />
    </QueryClientProvider>
  );
}
