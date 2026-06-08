import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Loading, Card, Button, Input, EmptyState } from '@/components/ui';
import { listCompetitionTeams, getLongTerm, saveLongTerm } from '@/services/firebase/longTerm';
import { Pool, Team, UserProfile } from '@/types';
import { colors, spacing, fontSize, fontWeight, radius } from '@/theme';

/**
 * Aba de palpites de longo prazo (seção 6.7). Campeão e vice são
 * escolhidos entre os times reais da competição; artilheiro e craque
 * são texto livre (até existir uma base de jogadores).
 */
export function LongTermTab({ pool, user }: { pool: Pool; user: UserProfile }) {
  const qc = useQueryClient();
  const teams = useQuery({
    queryKey: ['teams', pool.competitionId],
    queryFn: () => listCompetitionTeams(pool.competitionId),
  });
  const existing = useQuery({
    queryKey: ['longTerm', pool.id, user.id],
    queryFn: () => getLongTerm(pool.id, user.id),
  });

  const [champion, setChampion] = useState<Team | null>(null);
  const [runnerUp, setRunnerUp] = useState<Team | null>(null);
  const [topScorer, setTopScorer] = useState('');
  const [bestPlayer, setBestPlayer] = useState('');
  const [picking, setPicking] = useState<null | 'champion' | 'runnerUp'>(null);
  const [saving, setSaving] = useState(false);

  // Preenche o formulário com o que já foi salvo.
  useEffect(() => {
    const d = existing.data;
    if (!d || !teams.data) return;
    setChampion(teams.data.find((t) => t.id === d.championTeamId) ?? null);
    setRunnerUp(teams.data.find((t) => t.id === d.runnerUpTeamId) ?? null);
    setTopScorer(d.topScorerName ?? '');
    setBestPlayer(d.bestPlayerName ?? '');
  }, [existing.data, teams.data]);

  if (!pool.settings.modules.longTermPredictions) {
    return (
      <EmptyState
        icon="🔮"
        title="Longo prazo desativado"
        message="Este módulo não foi ativado nas regras deste bolão."
      />
    );
  }

  if (teams.isLoading || existing.isLoading) return <Loading />;
  if (!teams.data || teams.data.length === 0) {
    return (
      <EmptyState
        icon="📋"
        title="Sem times cadastrados"
        message="Os palpites de campeão dependem dos jogos da competição."
      />
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveLongTerm(pool.id, user, {
        championTeamId: champion?.id,
        championTeamName: champion?.name,
        runnerUpTeamId: runnerUp?.id,
        runnerUpTeamName: runnerUp?.name,
        topScorerName: topScorer.trim() || null,
        bestPlayerName: bestPlayer.trim() || null,
      });
      qc.invalidateQueries({ queryKey: ['longTerm', pool.id, user.id] });
      Alert.alert('Salvo!', 'Seus palpites de longo prazo foram registrados.');
    } catch (e) {
      console.error(e);
      Alert.alert('Ops', 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  // Seletor de time (lista simples que aparece ao tocar num campo).
  if (picking) {
    return (
      <View>
        <View style={styles.pickHeader}>
          <Text style={styles.pickTitle}>
            Escolha o {picking === 'champion' ? 'campeão' : 'vice'}
          </Text>
          <Pressable onPress={() => setPicking(null)} hitSlop={10}>
            <Ionicons name="close" size={24} color={colors.offWhite} />
          </Pressable>
        </View>
        {teams.data.map((t) => (
          <Card
            key={t.id}
            onPress={() => {
              if (picking === 'champion') setChampion(t);
              else setRunnerUp(t);
              setPicking(null);
            }}
            style={styles.teamRow}
          >
            <Text style={styles.teamName}>{t.name}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Card>
        ))}
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      <Card style={{ gap: spacing.sm }}>
        <Text style={styles.label}>🏆 Campeão</Text>
        <SelectButton
          value={champion?.name}
          placeholder="Escolher time campeão"
          onPress={() => setPicking('champion')}
        />
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <Text style={styles.label}>🥈 Vice-campeão</Text>
        <SelectButton
          value={runnerUp?.name}
          placeholder="Escolher vice-campeão"
          onPress={() => setPicking('runnerUp')}
        />
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <Text style={styles.label}>⚽ Artilheiro</Text>
        <Input
          placeholder="Nome do artilheiro"
          value={topScorer}
          onChangeText={setTopScorer}
          style={{ marginBottom: 0 }}
        />
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <Text style={styles.label}>⭐ Craque do campeonato</Text>
        <Input
          placeholder="Nome do melhor jogador"
          value={bestPlayer}
          onChangeText={setBestPlayer}
          style={{ marginBottom: 0 }}
        />
      </Card>

      <Button title="Salvar palpites de longo prazo" onPress={handleSave} loading={saving} />
    </View>
  );
}

function SelectButton({
  value,
  placeholder,
  onPress,
}: {
  value?: string;
  placeholder: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.select} onPress={onPress}>
      <Text style={[styles.selectText, !value && { color: colors.textMuted }]}>
        {value ?? placeholder}
      </Text>
      <Ionicons name="chevron-down" size={18} color={colors.gold} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.greenDark,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  selectText: { color: colors.textPrimary, fontSize: fontSize.md },
  pickHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  pickTitle: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  teamRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  teamName: { color: colors.textPrimary, fontSize: fontSize.md },
});
