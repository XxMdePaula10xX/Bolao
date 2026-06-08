import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Title, Subtitle, Loading, EmptyState, Card, Button } from '@/components/ui';
import { PoolCard } from '@/features/pools/PoolCard';
import { listMyPools } from '@/services/firebase/pools';
import { Pool } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing } from '@/theme';

export default function MyPoolsScreen() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const pools = useQuery({
    queryKey: ['myPools', profile?.id],
    queryFn: () => listMyPools(profile!.id),
    enabled: !!profile,
  });

  return (
    <Screen scroll>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Title>Meus Bolões</Title>
          <Subtitle>Bolões que você criou ou participa.</Subtitle>
        </View>
        <Pressable style={styles.createBtn} onPress={() => router.push('/create-pool')}>
          <Ionicons name="add" size={22} color={colors.grayDark} />
        </Pressable>
      </View>

      {pools.isLoading ? (
        <Loading />
      ) : pools.data && pools.data.length > 0 ? (
        pools.data.map((p: Pool) => <PoolCard key={p.id} pool={p} />)
      ) : (
        <Card style={{ gap: spacing.lg }}>
          <EmptyState
            icon="🏆"
            title="Nenhum bolão por aqui ainda"
            message="Crie um bolão novo ou entre em um pelo código de convite."
          />
          <Button title="Criar meu primeiro bolão" onPress={() => router.push('/create-pool')} />
          <Button
            title="Entrar por código"
            variant="outline"
            onPress={() => router.push('/join')}
          />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  createBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
