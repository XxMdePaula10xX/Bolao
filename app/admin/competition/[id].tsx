import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Card, Button, Input, Loading, EmptyState, Badge } from '@/components/ui';
import { listMatches } from '@/services/firebase/matches';
import { addManualMatch, setMatchResult } from '@/services/firebase/admin';
import { useAuthStore } from '@/store/authStore';
import { Match } from '@/types';
import { formatMatchDate } from '@/lib/utils';
import { colors, spacing, fontSize, fontWeight, radius } from '@/theme';

export default function AdminCompetitionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { profile } = useAuthStore();

  const matches = useQuery({
    queryKey: ['matches', id],
    queryFn: () => listMatches(id!),
    enabled: !!id,
  });

  const [home, setHome] = useState('');
  const [away, setAway] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('16:00');
  const [adding, setAdding] = useState(false);

  async function addMatch() {
    if (!home.trim() || !away.trim()) {
      Alert.alert('Atenção', 'Preencha os dois times.');
      return;
    }
    const parsed = new Date(`${date}T${(time || '00:00')}:00`);
    if (isNaN(parsed.getTime())) {
      Alert.alert('Data inválida', 'Use o formato AAAA-MM-DD (ex: 2026-06-15) e hora HH:MM.');
      return;
    }
    setAdding(true);
    try {
      await addManualMatch(id!, { homeName: home, awayName: away, date: parsed });
      qc.invalidateQueries({ queryKey: ['matches', id] });
      setHome('');
      setAway('');
    } catch (e: any) {
      Alert.alert('Ops', e?.message ?? 'Não foi possível adicionar.');
    } finally {
      setAdding(false);
    }
  }

  if (!profile?.isSystemAdmin) {
    return (
      <View style={styles.container}>
        <Header onBack={() => router.back()} title="Admin" />
        <EmptyState icon="🔒" title="Área restrita" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header onBack={() => router.back()} title="Gerenciar jogos" />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Card style={{ gap: spacing.sm }}>
          <Text style={styles.sectionTitle}>Adicionar jogo</Text>
          <Input label="Time mandante" placeholder="Ex: Flamengo" value={home} onChangeText={setHome} />
          <Input label="Time visitante" placeholder="Ex: Palmeiras" value={away} onChangeText={setAway} />
          <Input
            label="Data (AAAA-MM-DD)"
            placeholder="2026-06-15"
            value={date}
            onChangeText={setDate}
          />
          <Input label="Hora (HH:MM)" placeholder="16:00" value={time} onChangeText={setTime} />
          <Button title="Adicionar jogo" onPress={addMatch} loading={adding} />
        </Card>

        <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>Jogos cadastrados</Text>
        {matches.isLoading ? (
          <Loading />
        ) : matches.data && matches.data.length > 0 ? (
          matches.data.map((m: Match) => (
            <MatchAdminRow
              key={m.id}
              match={m}
              onSaved={() => qc.invalidateQueries({ queryKey: ['matches', id] })}
            />
          ))
        ) : (
          <Text style={styles.hint}>Nenhum jogo ainda. Adicione acima.</Text>
        )}
      </ScrollView>
    </View>
  );
}

function MatchAdminRow({ match, onSaved }: { match: Match; onSaved: () => void }) {
  const [hs, setHs] = useState(match.homeScore != null ? String(match.homeScore) : '');
  const [as, setAs] = useState(match.awayScore != null ? String(match.awayScore) : '');
  const [saving, setSaving] = useState(false);

  async function save(finished: boolean) {
    if (hs === '' || as === '') {
      Alert.alert('Atenção', 'Preencha os dois placares.');
      return;
    }
    setSaving(true);
    try {
      await setMatchResult(match.id, Number(hs), Number(as), finished);
      onSaved();
    } catch (e: any) {
      Alert.alert('Ops', e?.message ?? 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card style={{ gap: spacing.sm, marginBottom: spacing.sm }}>
      <View style={styles.rowTop}>
        <Text style={styles.matchDate}>{formatMatchDate(match.startTime)}</Text>
        <Badge
          label={
            match.status === 'finished'
              ? 'Encerrado'
              : match.status === 'live'
                ? 'Ao vivo'
                : 'Agendado'
          }
          color={match.status === 'finished' ? colors.grayMedium : colors.greenMedium}
        />
      </View>
      <Text style={styles.teams}>
        {match.homeTeam.name} x {match.awayTeam.name}
      </Text>
      <View style={styles.scoreRow}>
        <TextInput
          style={styles.scoreBox}
          value={hs}
          onChangeText={(v) => setHs(v.replace(/[^0-9]/g, '').slice(0, 2))}
          keyboardType="number-pad"
          placeholder="-"
          placeholderTextColor={colors.textMuted}
          textAlign="center"
        />
        <Text style={styles.x}>x</Text>
        <TextInput
          style={styles.scoreBox}
          value={as}
          onChangeText={(v) => setAs(v.replace(/[^0-9]/g, '').slice(0, 2))}
          keyboardType="number-pad"
          placeholder="-"
          placeholderTextColor={colors.textMuted}
          textAlign="center"
        />
        <View style={{ flex: 1 }} />
        <Button
          title={match.status === 'finished' ? 'Atualizar' : 'Encerrar'}
          onPress={() => save(true)}
          loading={saving}
          fullWidth={false}
          style={{ paddingHorizontal: spacing.lg }}
        />
      </View>
      <Text style={styles.hint}>
        "Encerrar" lança o placar final e dispara o cálculo da pontuação dos bolões.
      </Text>
    </Card>
  );
}

function Header({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={12}>
        <Ionicons name="arrow-back" size={26} color={colors.offWhite} />
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ width: 26 }} />
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
    paddingBottom: spacing.md,
  },
  headerTitle: { color: colors.offWhite, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  sectionTitle: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  hint: { color: colors.textSecondary, fontSize: fontSize.xs, lineHeight: 16 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  matchDate: { color: colors.textSecondary, fontSize: fontSize.xs },
  teams: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  scoreBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.greenDark,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.gold,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  x: { color: colors.textMuted, fontSize: fontSize.md },
});
