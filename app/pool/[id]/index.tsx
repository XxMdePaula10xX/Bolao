import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { Loading, Card, Badge, EmptyState, Avatar } from '@/components/ui';
import { getPool, listPoolMembers } from '@/services/firebase/pools';
import { RankingTable } from '@/features/standings/RankingTable';
import { PredictionsTab } from '@/features/predictions/PredictionsTab';
import { CupTab } from '@/features/brackets/CupTab';
import { LongTermTab } from '@/features/longterm/LongTermTab';
import { FeedTab } from '@/features/feed/FeedTab';
import { buildRegulation, statusLabel, statusColor } from '@/features/pools/regulation';
import { useAuthStore } from '@/store/authStore';
import { Pool, PoolMember } from '@/types';
import { colors, spacing, fontSize, fontWeight, radius } from '@/theme';

type IconName = keyof typeof import('@expo/vector-icons').Ionicons.glyphMap;
type TabKey =
  | 'overview'
  | 'matches'
  | 'ranking'
  | 'cup'
  | 'losersCup'
  | 'longterm'
  | 'feed'
  | 'rules'
  | 'members';

/**
 * Monta a lista de abas conforme os módulos ativados nas regras do
 * bolão (Copa, Copa dos Ruins e Longo prazo aparecem só se ligados).
 */
function buildTabs(pool: Pool): { key: TabKey; label: string; icon: IconName }[] {
  const tabs: { key: TabKey; label: string; icon: IconName }[] = [
    { key: 'overview', label: 'Visão geral', icon: 'grid' },
    { key: 'matches', label: 'Jogos', icon: 'football' },
    { key: 'ranking', label: 'Ranking', icon: 'podium' },
  ];
  const m = pool.settings.modules;
  if (m.cup) tabs.push({ key: 'cup', label: 'Copa', icon: 'trophy' });
  if (m.losersCup) tabs.push({ key: 'losersCup', label: 'Copa dos Ruins', icon: 'sad' });
  if (m.longTermPredictions)
    tabs.push({ key: 'longterm', label: 'Longo prazo', icon: 'sparkles' });
  tabs.push({ key: 'feed', label: 'Feed', icon: 'chatbubbles' });
  tabs.push({ key: 'rules', label: 'Regras', icon: 'document-text' });
  tabs.push({ key: 'members', label: 'Membros', icon: 'people' });
  return tabs;
}

export default function PoolDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuthStore();
  const [tab, setTab] = useState<TabKey>('overview');

  const pool = useQuery({
    queryKey: ['pool', id],
    queryFn: () => getPool(id!),
    enabled: !!id,
  });

  if (pool.isLoading) return <Loading label="Carregando bolão..." />;
  if (!pool.data) {
    return (
      <View style={styles.container}>
        <Header onBack={() => router.back()} title="Bolão" />
        <EmptyState icon="❓" title="Bolão não encontrado" />
      </View>
    );
  }

  const p = pool.data;

  async function shareInvite() {
    const message = `Bora pro meu bolão "${p.name}" no Bolão Flex! Código de convite: ${p.inviteCode}`;
    try {
      await Share.share({ message });
    } catch {
      await Clipboard.setStringAsync(p.inviteCode);
      Alert.alert('Código copiado', p.inviteCode);
    }
  }

  return (
    <View style={styles.container}>
      <Header onBack={() => router.back()} title={p.name} onShare={shareInvite} />

      {/* Abas horizontais */}
      <View style={styles.tabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {buildTabs(p).map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[styles.tab, tab === t.key && styles.tabActive]}
            >
              <Ionicons
                name={t.icon}
                size={16}
                color={tab === t.key ? colors.grayDark : colors.textSecondary}
              />
              <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {tab === 'overview' && <OverviewTab pool={p} onShare={shareInvite} />}
        {tab === 'matches' &&
          (profile ? (
            <PredictionsTab pool={p} userId={profile.id} />
          ) : (
            <Loading />
          ))}
        {tab === 'ranking' && <RankingTable poolId={p.id} currentUserId={profile?.id} />}
        {tab === 'cup' &&
          (profile ? <CupTab pool={p} user={profile} type="cup" /> : <Loading />)}
        {tab === 'losersCup' &&
          (profile ? <CupTab pool={p} user={profile} type="losersCup" /> : <Loading />)}
        {tab === 'longterm' &&
          (profile ? <LongTermTab pool={p} user={profile} /> : <Loading />)}
        {tab === 'feed' &&
          (profile ? <FeedTab pool={p} user={profile} /> : <Loading />)}
        {tab === 'rules' && <RegulationTab pool={p} />}
        {tab === 'members' && <MembersTab poolId={p.id} ownerId={p.ownerId} />}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
function OverviewTab({ pool, onShare }: { pool: Pool; onShare: () => void }) {
  return (
    <View style={{ gap: spacing.md }}>
      <Card style={{ gap: spacing.md }}>
        <View style={styles.coverBig}>
          <Text style={{ fontSize: 40 }}>{pool.createdByAdmin ? '⭐' : '⚽'}</Text>
        </View>
        <Text style={styles.poolName}>{pool.name}</Text>
        {pool.description ? <Text style={styles.desc}>{pool.description}</Text> : null}
        <View style={styles.badgeRow}>
          <Badge label={statusLabel[pool.status]} color={statusColor[pool.status]} />
          <Badge label={pool.isPublic ? 'Público' : 'Privado'} color={colors.surfaceElevated} />
          {pool.createdByAdmin ? (
            <Badge label="Oficial" color={colors.gold} textColor={colors.grayDark} />
          ) : null}
        </View>
      </Card>

      <View style={styles.infoGrid}>
        <InfoBox icon="trophy" label="Competição" value={pool.competitionName || '—'} />
        <InfoBox icon="people" label="Participantes" value={String(pool.memberCount)} />
      </View>

      <Card style={styles.inviteCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.inviteLabel}>Código de convite</Text>
          <Text style={styles.inviteCode}>{pool.inviteCode}</Text>
        </View>
        <Pressable style={styles.shareBtn} onPress={onShare}>
          <Ionicons name="share-social" size={20} color={colors.grayDark} />
          <Text style={styles.shareBtnText}>Convidar</Text>
        </Pressable>
      </Card>

      {pool.prize ? (
        <Card>
          <Text style={styles.inviteLabel}>🏆 Premiação</Text>
          <Text style={styles.desc}>{pool.prize}</Text>
        </Card>
      ) : null}
    </View>
  );
}

function RegulationTab({ pool }: { pool: Pool }) {
  const sections = buildRegulation(pool);
  return (
    <View style={{ gap: spacing.md }}>
      {sections.map((section) => (
        <Card key={section.title} style={{ gap: spacing.sm }}>
          <Text style={styles.ruleTitle}>{section.title}</Text>
          {section.lines.map((line, i) => (
            <Text key={i} style={styles.ruleLine}>
              • {line}
            </Text>
          ))}
        </Card>
      ))}
    </View>
  );
}

function MembersTab({ poolId, ownerId }: { poolId: string; ownerId: string }) {
  const members = useQuery({
    queryKey: ['poolMembers', poolId],
    queryFn: () => listPoolMembers(poolId),
  });
  if (members.isLoading) return <Loading />;
  if (!members.data?.length) return <EmptyState icon="👥" title="Sem participantes" />;
  return (
    <View style={{ gap: spacing.sm }}>
      {members.data.map((m: PoolMember) => (
        <Card key={m.id} style={styles.memberRow}>
          <Avatar name={m.userName} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={styles.memberName}>{m.userName}</Text>
            <Text style={styles.memberRole}>
              {m.userId === ownerId ? 'Organizador' : 'Participante'}
            </Text>
          </View>
          <Text style={styles.memberPoints}>{m.totalPoints} pts</Text>
        </Card>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
function Header({
  onBack,
  title,
  onShare,
}: {
  onBack: () => void;
  title: string;
  onShare?: () => void;
}) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={12}>
        <Ionicons name="arrow-back" size={26} color={colors.offWhite} />
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      {onShare ? (
        <Pressable onPress={onShare} hitSlop={12}>
          <Ionicons name="share-social" size={24} color={colors.gold} />
        </Pressable>
      ) : (
        <View style={{ width: 26 }} />
      )}
    </View>
  );
}

function InfoBox({
  icon,
  label,
  value,
}: {
  icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <Card style={styles.infoBox}>
      <Ionicons name={icon} size={22} color={colors.gold} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 48 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  headerTitle: { flex: 1, color: colors.offWhite, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  tabsWrap: { borderBottomWidth: 1, borderBottomColor: colors.border },
  tabs: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.md },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  tabLabel: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  tabLabelActive: { color: colors.grayDark },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  coverBig: {
    height: 100,
    borderRadius: radius.md,
    backgroundColor: colors.greenDark,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  poolName: { color: colors.textPrimary, fontSize: fontSize.xl, fontWeight: fontWeight.extrabold },
  desc: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20 },
  badgeRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  infoGrid: { flexDirection: 'row', gap: spacing.md },
  infoBox: { flex: 1, alignItems: 'center', gap: 4 },
  infoLabel: { color: colors.textMuted, fontSize: fontSize.xs },
  infoValue: { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  inviteCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  inviteLabel: { color: colors.textMuted, fontSize: fontSize.xs },
  inviteCode: { color: colors.gold, fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, letterSpacing: 2 },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  shareBtnText: { color: colors.grayDark, fontWeight: fontWeight.bold },
  ruleTitle: { color: colors.gold, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  ruleLine: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  memberName: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  memberRole: { color: colors.textSecondary, fontSize: fontSize.xs },
  memberPoints: { color: colors.gold, fontSize: fontSize.md, fontWeight: fontWeight.bold },
});
