import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen, Title, Card, Button, Avatar, Loading } from '@/components/ui';
import { logout } from '@/services/firebase/auth';
import { listMyPools } from '@/services/firebase/pools';
import { useAuthStore } from '@/store/authStore';
import { Pool } from '@/types';
import { colors, spacing, fontSize, fontWeight } from '@/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const pools = useQuery({
    queryKey: ['myPools', profile?.id],
    queryFn: () => listMyPools(profile!.id),
    enabled: !!profile,
  });

  function confirmLogout() {
    Alert.alert('Sair', 'Deseja realmente sair da sua conta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => logout() },
    ]);
  }

  if (!profile) return <Loading />;

  const created = pools.data?.filter((p: Pool) => p.ownerId === profile.id).length ?? 0;
  const joined = pools.data?.length ?? 0;

  return (
    <Screen scroll>
      <Title>Perfil</Title>

      <Card style={styles.profileCard}>
        <Avatar name={profile.name} size={72} />
        <Text style={styles.name}>{profile.name}</Text>
        <Text style={styles.email}>{profile.email}</Text>
        {profile.isSystemAdmin ? (
          <Text style={styles.admin}>⭐ Admin do sistema</Text>
        ) : null}
      </Card>

      <View style={styles.statsRow}>
        <Stat label="Bolões criados" value={created} />
        <Stat label="Participando" value={joined} />
        <Stat label="Pontos" value={profile.stats?.totalPoints ?? 0} />
      </View>

      <Card style={{ gap: spacing.md, marginTop: spacing.lg }}>
        <Text style={styles.sectionTitle}>Conta</Text>
        <Text style={styles.muted}>
          Em breve: editar nome, foto e username. Por enquanto, o essencial já
          funciona.
        </Text>
        <Button title="Sair da conta" variant="danger" onPress={confirmLogout} />
      </Card>

      {profile.isSystemAdmin ? (
        <Card style={{ gap: spacing.sm, marginTop: spacing.lg }}>
          <Text style={styles.sectionTitle}>⭐ Admin do sistema</Text>
          <Text style={styles.muted}>
            Cadastre competições e jogos (importe de uma liga ou adicione na mão).
          </Text>
          <Button
            title="Abrir painel do admin"
            variant="secondary"
            onPress={() => router.push('/admin')}
          />
        </Card>
      ) : null}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  profileCard: { alignItems: 'center', gap: spacing.xs, marginTop: spacing.md },
  name: { color: colors.textPrimary, fontSize: fontSize.xl, fontWeight: fontWeight.bold, marginTop: spacing.sm },
  email: { color: colors.textSecondary, fontSize: fontSize.sm },
  admin: { color: colors.gold, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  stat: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  statValue: { color: colors.gold, fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold },
  statLabel: { color: colors.textSecondary, fontSize: fontSize.xs, textAlign: 'center' },
  sectionTitle: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  muted: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20 },
});
