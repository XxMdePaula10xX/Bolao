import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Card, Loading, EmptyState } from '@/components/ui';
import {
  listNotifications,
  markNotificationRead,
} from '@/services/firebase/notifications';
import { useAuthStore } from '@/store/authStore';
import { AppNotification } from '@/types';
import { formatMatchDate } from '@/lib/utils';
import { colors, spacing, fontSize, fontWeight } from '@/theme';

export default function NotificationsScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { profile } = useAuthStore();

  const notifications = useQuery({
    queryKey: ['notifications', profile?.id],
    queryFn: () => listNotifications(profile!.id),
    enabled: !!profile,
  });

  async function open(n: AppNotification) {
    if (!n.read) {
      await markNotificationRead(n.id).catch(() => {});
      qc.invalidateQueries({ queryKey: ['notifications', profile?.id] });
    }
    if (n.poolId) router.replace(`/pool/${n.poolId}`);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.offWhite} />
        </Pressable>
        <Text style={styles.headerTitle}>Notificações</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.content}>
        {notifications.isLoading ? (
          <Loading />
        ) : notifications.data && notifications.data.length > 0 ? (
          notifications.data.map((n: AppNotification) => (
            <Card
              key={n.id}
              onPress={() => open(n)}
              style={[styles.notif, !n.read && styles.unread]}
            >
              <View style={styles.notifRow}>
                <View style={styles.dotWrap}>
                  {!n.read ? <View style={styles.dot} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{n.title}</Text>
                  <Text style={styles.body}>{n.body}</Text>
                  <Text style={styles.date}>{formatMatchDate(n.createdAt)}</Text>
                </View>
              </View>
            </Card>
          ))
        ) : (
          <EmptyState
            icon="🔔"
            title="Sem notificações"
            message="Avisos sobre jogos, prazos e rankings aparecem aqui."
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 48 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  headerTitle: { color: colors.offWhite, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  content: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  notif: { marginBottom: spacing.xs },
  unread: { borderColor: colors.gold },
  notifRow: { flexDirection: 'row', gap: spacing.sm },
  dotWrap: { width: 12, alignItems: 'center', paddingTop: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold },
  title: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  body: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 2 },
  date: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: spacing.xs },
});
