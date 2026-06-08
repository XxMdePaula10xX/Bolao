import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Loading, EmptyState, Avatar } from '@/components/ui';
import { listPoolMembers } from '@/services/firebase/pools';
import { PoolMember } from '@/types';
import { colors, spacing, fontSize, fontWeight } from '@/theme';

/** Tabela de ranking geral (RF-07 / seção 6.8). */
export function RankingTable({
  poolId,
  currentUserId,
}: {
  poolId: string;
  currentUserId?: string;
}) {
  const members = useQuery({
    queryKey: ['poolMembers', poolId],
    queryFn: () => listPoolMembers(poolId),
  });

  if (members.isLoading) return <Loading />;
  if (!members.data || members.data.length === 0) {
    return <EmptyState icon="📊" title="Sem participantes ainda" />;
  }

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={[styles.h, styles.pos]}>#</Text>
        <Text style={[styles.h, styles.player]}>Participante</Text>
        <Text style={[styles.h, styles.num]}>Exatos</Text>
        <Text style={[styles.h, styles.num]}>Pts</Text>
      </View>
      {members.data.map((m: PoolMember, i: number) => {
        const isMe = m.userId === currentUserId;
        return (
          <View key={m.id} style={[styles.row, isMe && styles.rowMe]}>
            <Text style={[styles.pos, styles.posText, i < 3 && styles.podium]}>
              {i + 1}º
            </Text>
            <View style={[styles.player, styles.playerCell]}>
              <Avatar name={m.userName} size={32} />
              <Text style={styles.playerName} numberOfLines={1}>
                {m.userName}
                {isMe ? ' (você)' : ''}
              </Text>
            </View>
            <Text style={[styles.num, styles.numText]}>{m.exactHits}</Text>
            <Text style={[styles.num, styles.points]}>{m.totalPoints}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  h: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  rowMe: { borderColor: colors.gold },
  pos: { width: 36 },
  posText: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  podium: { color: colors.gold },
  player: { flex: 1 },
  playerCell: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  playerName: { color: colors.textPrimary, fontSize: fontSize.sm, flex: 1 },
  num: { width: 52, textAlign: 'center' },
  numText: { color: colors.textSecondary, fontSize: fontSize.sm },
  points: { color: colors.gold, fontSize: fontSize.md, fontWeight: fontWeight.extrabold },
});
