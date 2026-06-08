import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Title, Loading, EmptyState, Card } from '@/components/ui';
import { PoolCard } from '@/features/pools/PoolCard';
import { listMyPools, listOfficialPools } from '@/services/firebase/pools';
import { Pool } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing, fontSize, fontWeight } from '@/theme';

export default function HomeScreen() {
  const router = useRouter();
  const { profile } = useAuthStore();

  const myPools = useQuery({
    queryKey: ['myPools', profile?.id],
    queryFn: () => listMyPools(profile!.id),
    enabled: !!profile,
  });

  const official = useQuery({
    queryKey: ['officialPools'],
    queryFn: listOfficialPools,
  });

  if (myPools.isLoading) return <Loading label="Carregando seus bolões..." />;

  return (
    <Screen scroll>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.greeting}>Olá,</Text>
          <Title>{profile?.name?.split(' ')[0] ?? 'Palpiteiro'} 👋</Title>
        </View>
        <Pressable style={styles.createBtn} onPress={() => router.push('/create-pool')}>
          <Ionicons name="add" size={22} color={colors.grayDark} />
        </Pressable>
      </View>

      {/* Atalhos rápidos */}
      <View style={styles.quickRow}>
        <QuickAction
          icon="add-circle"
          label="Criar bolão"
          onPress={() => router.push('/create-pool')}
        />
        <QuickAction
          icon="enter"
          label="Entrar por código"
          onPress={() => router.push('/join')}
        />
        <QuickAction
          icon="compass"
          label="Explorar"
          onPress={() => router.push('/(app)/explore')}
        />
      </View>

      <SectionHeader title="Meus bolões" onSeeAll={() => router.push('/(app)/my-pools')} />
      {myPools.data && myPools.data.length > 0 ? (
        myPools.data.slice(0, 3).map((p: Pool) => <PoolCard key={p.id} pool={p} />)
      ) : (
        <Card>
          <EmptyState
            icon="🎯"
            title="Você ainda não está em nenhum bolão"
            message="Crie o seu ou entre em um pelo código de convite."
          />
        </Card>
      )}

      <SectionHeader title="Bolões oficiais" />
      {official.isLoading ? (
        <Loading />
      ) : official.data && official.data.length > 0 ? (
        official.data.map((p: Pool) => <PoolCard key={p.id} pool={p} />)
      ) : (
        <Card>
          <Text style={styles.muted}>
            Nenhum bolão oficial disponível no momento. Eles aparecem aqui quando o
            sistema publica um.
          </Text>
        </Card>
      )}
    </Screen>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.quick} onPress={onPress}>
      <Ionicons name={icon} size={24} color={colors.gold} />
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onSeeAll ? (
        <Text style={styles.seeAll} onPress={onSeeAll}>
          Ver todos
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  greeting: { color: colors.textSecondary, fontSize: fontSize.md },
  createBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  quick: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  quickLabel: { color: colors.textSecondary, fontSize: fontSize.xs, textAlign: 'center' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  seeAll: { color: colors.gold, fontSize: fontSize.sm },
  muted: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20 },
});
