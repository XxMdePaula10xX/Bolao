import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Badge } from '@/components/ui';
import { Pool } from '@/types';
import { statusLabel, statusColor } from './regulation';
import { colors, spacing, fontSize, fontWeight } from '@/theme';

/** Card de um bolão usado nas listas (Home, Explorar, Meus Bolões). */
export function PoolCard({ pool }: { pool: Pool }) {
  const router = useRouter();
  return (
    <Card onPress={() => router.push(`/pool/${pool.id}`)} style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.cover}>
          <Text style={styles.coverEmoji}>{pool.createdByAdmin ? '⭐' : '⚽'}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {pool.name}
          </Text>
          <Text style={styles.competition} numberOfLines={1}>
            {pool.competitionName || 'Competição'}
          </Text>
          <View style={styles.badges}>
            <Badge label={statusLabel[pool.status]} color={statusColor[pool.status]} />
            {pool.createdByAdmin ? (
              <Badge label="Oficial" color={colors.gold} textColor={colors.grayDark} />
            ) : (
              <Badge
                label={pool.isPublic ? 'Público' : 'Privado'}
                color={colors.surfaceElevated}
              />
            )}
          </View>
        </View>
      </View>
      <View style={styles.footer}>
        <Text style={styles.members}>👥 {pool.memberCount} participante(s)</Text>
        {pool.prize ? <Text style={styles.prize}>🏆 {pool.prize}</Text> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md, gap: spacing.md },
  topRow: { flexDirection: 'row', gap: spacing.md },
  cover: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.greenDark,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverEmoji: { fontSize: 26 },
  info: { flex: 1, gap: 2 },
  name: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  competition: { color: colors.textSecondary, fontSize: fontSize.sm },
  badges: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  members: { color: colors.textSecondary, fontSize: fontSize.xs },
  prize: { color: colors.gold, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
});
