import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Loading, Card, Button, EmptyState } from '@/components/ui';
import {
  getBracket,
  generateAndSaveBracket,
  updateBracketWinner,
} from '@/services/firebase/brackets';
import { BracketData, BracketMatch, BracketRound, getChampion } from '@/lib/bracket';
import { Pool, TournamentType, UserProfile } from '@/types';
import { colors, spacing, fontSize, fontWeight, radius } from '@/theme';

/**
 * Aba de Copa / Copa dos Ruins (seção 6.9). Mostra o chaveamento
 * visual. O organizador gera o chaveamento e define os vencedores de
 * cada confronto (avanço manual — simples e transparente).
 */
export function CupTab({
  pool,
  user,
  type,
}: {
  pool: Pool;
  user: UserProfile;
  type: TournamentType;
}) {
  const qc = useQueryClient();
  const isOwner = pool.ownerId === user.id;
  const bracketQuery = useQuery({
    queryKey: ['bracket', pool.id, type],
    queryFn: () => getBracket(pool.id, type),
  });
  const [generating, setGenerating] = useState(false);

  const moduleOn =
    type === 'cup' ? pool.settings.modules.cup : pool.settings.modules.losersCup;
  if (!moduleOn) {
    return (
      <EmptyState
        icon={type === 'cup' ? '🏆' : '🥄'}
        title={type === 'cup' ? 'Copa desativada' : 'Copa dos Ruins desativada'}
        message="Este módulo não foi ativado nas regras deste bolão."
      />
    );
  }

  if (bracketQuery.isLoading) return <Loading />;

  const bracket = bracketQuery.data;

  async function handleGenerate() {
    Alert.alert(
      bracket ? 'Regerar chaveamento?' : 'Gerar chaveamento?',
      bracket
        ? 'Isso vai apagar o chaveamento atual e criar um novo com a classificação de agora.'
        : 'O chaveamento será montado com os participantes atuais, do melhor para o pior colocado.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: bracket ? 'Regerar' : 'Gerar',
          onPress: async () => {
            setGenerating(true);
            try {
              await generateAndSaveBracket(pool, user, type, 'leagueStanding');
              qc.invalidateQueries({ queryKey: ['bracket', pool.id, type] });
            } catch (e) {
              console.error(e);
              Alert.alert('Ops', 'Não foi possível gerar o chaveamento.');
            } finally {
              setGenerating(false);
            }
          },
        },
      ]
    );
  }

  async function handlePickWinner(roundIndex: number, match: BracketMatch, winnerId: string) {
    if (!isOwner || !bracket) return;
    try {
      await updateBracketWinner(bracket, roundIndex, match.id, winnerId);
      qc.invalidateQueries({ queryKey: ['bracket', pool.id, type] });
    } catch (e) {
      console.error(e);
    }
  }

  if (!bracket) {
    return (
      <View style={{ gap: spacing.lg }}>
        <EmptyState
          icon={type === 'cup' ? '🏆' : '🥄'}
          title="Chaveamento ainda não gerado"
          message={
            isOwner
              ? 'Gere o chaveamento quando os participantes estiverem definidos.'
              : 'O organizador ainda não gerou o chaveamento.'
          }
        />
        {isOwner ? (
          <Button title="Gerar chaveamento" onPress={handleGenerate} loading={generating} />
        ) : null}
      </View>
    );
  }

  const data: BracketData = { rounds: bracket.rounds as BracketRound[] };
  const champion = getChampion(data);

  return (
    <View style={{ gap: spacing.md }}>
      {champion ? (
        <Card style={styles.championCard}>
          <Text style={styles.championLabel}>🏆 Campeão</Text>
          <Text style={styles.championName}>{champion.userName}</Text>
        </Card>
      ) : null}

      {/* Chaveamento rola na horizontal: cada coluna é uma fase. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.bracketRow}>
          {data.rounds.map((round, ri) => (
            <View key={ri} style={styles.column}>
              <Text style={styles.stageTitle}>{round.stage}</Text>
              <View style={styles.columnMatches}>
                {round.matches.map((m) => (
                  <MatchBox
                    key={m.id}
                    match={m}
                    canEdit={isOwner}
                    onPick={(winnerId) => handlePickWinner(ri, m, winnerId)}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {isOwner ? (
        <Button
          title="Regerar chaveamento"
          variant="outline"
          onPress={handleGenerate}
          loading={generating}
        />
      ) : null}

      <Text style={styles.hint}>
        {isOwner
          ? 'Toque em um participante para marcá-lo como vencedor do confronto.'
          : 'Os vencedores são definidos pelo organizador.'}
      </Text>
    </View>
  );
}

function MatchBox({
  match,
  canEdit,
  onPick,
}: {
  match: BracketMatch;
  canEdit: boolean;
  onPick: (winnerId: string) => void;
}) {
  return (
    <Card style={styles.matchBox}>
      <SlotRow
        slot={match.slotA}
        bye={match.byeA}
        isWinner={!!match.winnerId && match.slotA?.userId === match.winnerId}
        canEdit={canEdit && !!match.slotA}
        onPick={() => match.slotA && onPick(match.slotA.userId)}
      />
      <View style={styles.divider} />
      <SlotRow
        slot={match.slotB}
        bye={match.byeB}
        isWinner={!!match.winnerId && match.slotB?.userId === match.winnerId}
        canEdit={canEdit && !!match.slotB}
        onPick={() => match.slotB && onPick(match.slotB.userId)}
      />
    </Card>
  );
}

function SlotRow({
  slot,
  bye,
  isWinner,
  canEdit,
  onPick,
}: {
  slot: { userId: string; userName: string } | null;
  bye?: boolean;
  isWinner: boolean;
  canEdit: boolean;
  onPick: () => void;
}) {
  const label = slot ? slot.userName : bye ? '— (bye)' : 'A definir';
  return (
    <Pressable
      onPress={canEdit ? onPick : undefined}
      style={[styles.slot, isWinner && styles.slotWinner]}
    >
      <Text
        style={[styles.slotText, isWinner && styles.slotTextWinner, !slot && styles.slotMuted]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {isWinner ? <Ionicons name="checkmark" size={16} color={colors.grayDark} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  championCard: { alignItems: 'center', borderColor: colors.gold, gap: 2 },
  championLabel: { color: colors.textSecondary, fontSize: fontSize.sm },
  championName: { color: colors.gold, fontSize: fontSize.xl, fontWeight: fontWeight.extrabold },
  bracketRow: { flexDirection: 'row', gap: spacing.lg, paddingVertical: spacing.sm },
  column: { width: 180 },
  stageTitle: {
    color: colors.gold,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  columnMatches: { gap: spacing.lg, flex: 1, justifyContent: 'space-around' },
  matchBox: { padding: spacing.sm, gap: 0 },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  slotWinner: { backgroundColor: colors.gold },
  slotText: { color: colors.textPrimary, fontSize: fontSize.sm, flex: 1 },
  slotTextWinner: { color: colors.grayDark, fontWeight: fontWeight.bold },
  slotMuted: { color: colors.textMuted },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 2 },
  hint: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    textAlign: 'center',
    lineHeight: 18,
  },
});
