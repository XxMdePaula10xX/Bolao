import React, { useMemo, useState } from 'react';
import { Alert, Image, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loading, EmptyState, Button, Card, Badge } from '@/components/ui';
import { useRealtimeMatches } from '@/features/matches/useRealtimeMatches';
import {
  listUserPredictions,
  submitPredictions,
  DraftPrediction,
} from '@/services/firebase/predictions';
import { Match, Pool, Prediction } from '@/types';
import { formatMatchDate, toDate } from '@/lib/utils';
import { colors, spacing, fontSize, fontWeight } from '@/theme';

/**
 * Aba de Jogos/Palpites (seção 6.6). Mostra os jogos da competição,
 * deixa o usuário preencher placares e envia em lote. Jogos que já
 * começaram ficam travados (regra obrigatória da seção 10).
 */
export function PredictionsTab({ pool, userId }: { pool: Pool; userId: string }) {
  const qc = useQueryClient();
  // Jogos em tempo real: o placar atualiza sozinho conforme a API
  // esportiva é sincronizada no Firestore.
  const matches = useRealtimeMatches(pool.competitionId);
  const predictions = useQuery({
    queryKey: ['userPredictions', pool.id, userId],
    queryFn: () => listUserPredictions(pool.id, userId),
  });

  // Rascunho local: { matchId: { home, away } }
  const [drafts, setDrafts] = useState<Record<string, { home: string; away: string }>>({});
  const [saving, setSaving] = useState(false);

  const matchesById = useMemo(() => {
    const map: Record<string, Match> = {};
    matches.matches.forEach((m: Match) => (map[m.id] = m));
    return map;
  }, [matches.matches]);

  const savedByMatch = useMemo(() => {
    const map: Record<string, { home: number; away: number }> = {};
    (predictions.data ?? []).forEach((p: Prediction) => {
      map[p.matchId] = { home: p.predictedHome, away: p.predictedAway };
    });
    return map;
  }, [predictions.data]);

  function getValue(matchId: string, side: 'home' | 'away'): string {
    if (drafts[matchId]?.[side] !== undefined) return drafts[matchId][side];
    const saved = savedByMatch[matchId];
    if (saved) return String(saved[side]);
    return '';
  }

  function setValue(matchId: string, side: 'home' | 'away', value: string) {
    const clean = value.replace(/[^0-9]/g, '').slice(0, 2);
    setDrafts((d) => ({
      ...d,
      [matchId]: {
        home: d[matchId]?.home ?? '',
        away: d[matchId]?.away ?? '',
        [side]: clean,
      },
    }));
  }

  function isLocked(match: Match): boolean {
    if (match.status !== 'scheduled') return true;
    const start = toDate(match.startTime)?.getTime() ?? 0;
    return start > 0 && start <= Date.now();
  }

  async function handleSave() {
    const payload: DraftPrediction[] = [];
    for (const [matchId, val] of Object.entries(drafts)) {
      if (val.home !== '' && val.away !== '') {
        payload.push({
          matchId,
          predictedHome: Number(val.home),
          predictedAway: Number(val.away),
        });
      }
    }
    if (payload.length === 0) {
      Alert.alert('Nada para salvar', 'Preencha pelo menos um placar.');
      return;
    }
    setSaving(true);
    try {
      const res = await submitPredictions(pool.id, userId, payload, matchesById);
      qc.invalidateQueries({ queryKey: ['userPredictions', pool.id, userId] });
      setDrafts({});
      Alert.alert(
        'Palpites salvos!',
        `${res.saved} palpite(s) salvo(s).` +
          (res.skipped ? ` ${res.skipped} ignorado(s) (jogo já começou).` : '')
      );
    } catch (e) {
      console.error(e);
      Alert.alert('Ops', 'Não foi possível salvar. Tente de novo.');
    } finally {
      setSaving(false);
    }
  }

  if (matches.loading) return <Loading label="Carregando jogos..." />;
  if (matches.matches.length === 0) {
    return (
      <EmptyState
        icon="📅"
        title="Nenhum jogo cadastrado"
        message="Os jogos aparecem aqui quando a competição é sincronizada (veja o README)."
      />
    );
  }

  const pendingCount = matches.matches.filter(
    (m: Match) => !isLocked(m) && !savedByMatch[m.id] && !drafts[m.id]?.home
  ).length;

  return (
    <View>
      {pendingCount > 0 ? (
        <Card style={styles.pendingCard}>
          <Text style={styles.pendingText}>
            ⏳ Você tem {pendingCount} palpite(s) pendente(s).
          </Text>
        </Card>
      ) : null}

      {matches.matches.map((m: Match) => {
        const locked = isLocked(m);
        const saved = savedByMatch[m.id];
        const isLive = m.status === 'live';
        return (
          <Card key={m.id} style={styles.matchCard}>
            <View style={styles.matchHeader}>
              <Text style={styles.matchDate}>
                {m.round ? `Rodada ${m.round} · ` : ''}
                {formatMatchDate(m.startTime)}
              </Text>
              {isLive ? (
                <Badge label="● AO VIVO" color={colors.error} />
              ) : locked ? (
                <Badge label="Fechado" color={colors.surfaceElevated} />
              ) : saved ? (
                <Badge label="Palpitado" color={colors.success} />
              ) : (
                <Badge label="Aberto" color={colors.highlight} textColor={colors.grayDark} />
              )}
            </View>

            <View style={styles.matchRow}>
              <View style={styles.teamSide}>
                <TeamCrest uri={m.homeTeam.crestUrl} />
                <Text style={styles.team} numberOfLines={1}>
                  {m.homeTeam.shortName || m.homeTeam.name}
                </Text>
              </View>
              <View style={styles.scoreInputs}>
                <ScoreBox
                  value={getValue(m.id, 'home')}
                  onChange={(v) => setValue(m.id, 'home', v)}
                  editable={!locked}
                />
                <Text style={styles.x}>x</Text>
                <ScoreBox
                  value={getValue(m.id, 'away')}
                  onChange={(v) => setValue(m.id, 'away', v)}
                  editable={!locked}
                />
              </View>
              <View style={[styles.teamSide, styles.teamSideRight]}>
                <Text style={[styles.team, styles.teamRight]} numberOfLines={1}>
                  {m.awayTeam.shortName || m.awayTeam.name}
                </Text>
                <TeamCrest uri={m.awayTeam.crestUrl} />
              </View>
            </View>

            {/* Placar real (atualiza ao vivo) */}
            {m.homeScore !== null && m.awayScore !== null ? (
              <Text style={[styles.realResult, isLive && styles.realResultLive]}>
                {isLive ? 'Parcial' : 'Resultado'}: {m.homeScore} x {m.awayScore}
              </Text>
            ) : null}
          </Card>
        );
      })}

      <Button title="Salvar palpites" onPress={handleSave} loading={saving} />
    </View>
  );
}

/**
 * Escudo do time. O <Image> do React Native não renderiza SVG, e alguns
 * escudos da API vêm em .svg — nesses casos mostramos um marcador neutro
 * em vez de uma imagem quebrada.
 */
function TeamCrest({ uri }: { uri?: string | null }) {
  const isImage = !!uri && !uri.toLowerCase().endsWith('.svg');
  if (!isImage) {
    return <View style={styles.crestPlaceholder} />;
  }
  return <Image source={{ uri: uri! }} style={styles.crest} resizeMode="contain" />;
}

function ScoreBox({
  value,
  onChange,
  editable,
}: {
  value: string;
  onChange: (v: string) => void;
  editable: boolean;
}) {
  return (
    <TextInput
      style={[styles.scoreBox, !editable && styles.scoreBoxLocked]}
      value={value}
      onChangeText={onChange}
      editable={editable}
      keyboardType="number-pad"
      maxLength={2}
      placeholder="-"
      placeholderTextColor={colors.textMuted}
      textAlign="center"
    />
  );
}

const styles = StyleSheet.create({
  pendingCard: { marginBottom: spacing.md, backgroundColor: colors.surfaceElevated },
  pendingText: { color: colors.highlight, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  matchCard: { marginBottom: spacing.md, gap: spacing.md },
  matchHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  matchDate: { color: colors.textSecondary, fontSize: fontSize.xs },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  teamSide: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  teamSideRight: { justifyContent: 'flex-end' },
  team: { flexShrink: 1, color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  teamRight: { textAlign: 'right' },
  crest: { width: 24, height: 24 },
  crestPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.greenDark,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scoreInputs: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  x: { color: colors.textMuted, fontSize: fontSize.md, marginHorizontal: 2 },
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
  scoreBoxLocked: { opacity: 0.5 },
  realResult: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  realResultLive: { color: colors.error, fontWeight: fontWeight.bold },
});
