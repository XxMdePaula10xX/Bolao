import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Card, Button, Input, Loading, EmptyState } from '@/components/ui';
import { listCompetitions } from '@/services/firebase/matches';
import {
  importLeagueFromTheSportsDB,
  importFromFootballData,
  createManualCompetition,
} from '@/services/firebase/admin';
import { POPULAR_LEAGUES } from '@/services/thesportsdb';
import { FREE_COMPETITIONS, hasFootballDataToken } from '@/services/footballData';
import { useAuthStore } from '@/store/authStore';
import { Competition } from '@/types';
import { colors, spacing, fontSize, fontWeight, radius } from '@/theme';

export default function AdminScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { profile } = useAuthStore();

  const competitions = useQuery({ queryKey: ['competitions'], queryFn: listCompetitions });

  const [customId, setCustomId] = useState('');
  const [importing, setImporting] = useState<string | null>(null);
  const [importingFd, setImportingFd] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newSeason, setNewSeason] = useState('');
  const [creating, setCreating] = useState(false);

  async function doImport(leagueId: string) {
    if (!leagueId) return;
    setImporting(leagueId);
    try {
      const res = await importLeagueFromTheSportsDB(leagueId);
      qc.invalidateQueries({ queryKey: ['competitions'] });
      Alert.alert('Importado!', `${res.name}: ${res.matches} jogo(s) adicionados.`);
      setCustomId('');
    } catch (e: any) {
      Alert.alert('Não deu certo', e?.message ?? 'Falha ao importar. Tente outra liga.');
    } finally {
      setImporting(null);
    }
  }

  async function doImportFd(code: string) {
    setImportingFd(code);
    try {
      const res = await importFromFootballData(code);
      qc.invalidateQueries({ queryKey: ['competitions'] });
      Alert.alert('Importado!', `${res.name}: ${res.matches} jogo(s) — temporada completa.`);
    } catch (e: any) {
      Alert.alert('Não deu certo', e?.message ?? 'Falha ao importar.');
    } finally {
      setImportingFd(null);
    }
  }

  async function createManual() {
    if (newName.trim().length < 3) {
      Alert.alert('Atenção', 'Dê um nome com pelo menos 3 letras.');
      return;
    }
    setCreating(true);
    try {
      const comp = await createManualCompetition(newName, newSeason || '2026');
      qc.invalidateQueries({ queryKey: ['competitions'] });
      setNewName('');
      setNewSeason('');
      router.push(`/admin/competition/${comp.id}`);
    } catch (e: any) {
      Alert.alert('Ops', e?.message ?? 'Não foi possível criar.');
    } finally {
      setCreating(false);
    }
  }

  // Bloqueio: só admin do sistema acessa.
  if (!profile?.isSystemAdmin) {
    return (
      <View style={styles.container}>
        <Header onBack={() => router.back()} title="Admin" />
        <View style={{ padding: spacing.lg }}>
          <EmptyState
            icon="🔒"
            title="Área restrita"
            message="Você não é admin do sistema. Veja o README (seção Admin) para se tornar um."
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header onBack={() => router.back()} title="Painel do admin" />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Importar football-data.org (temporada completa) */}
        <Text style={styles.sectionTitle}>Importar competição (temporada completa)</Text>
        <Text style={styles.hint}>
          football-data.org — Brasileirão, Libertadores, Champions e as grandes ligas.
        </Text>
        {hasFootballDataToken() ? (
          <View style={styles.leagueGrid}>
            {FREE_COMPETITIONS.map((c) => (
              <Pressable
                key={c.code}
                style={styles.leagueChip}
                onPress={() => doImportFd(c.code)}
                disabled={!!importingFd}
              >
                <Text style={styles.leagueChipText}>
                  {importingFd === c.code ? 'Importando…' : c.name}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Card style={{ marginBottom: spacing.md }}>
            <Text style={styles.hint}>
              Para usar esta fonte, pegue um token grátis em football-data.org/client/register
              e adicione no arquivo .env:{'\n'}
              EXPO_PUBLIC_FOOTBALL_DATA_TOKEN=seu_token{'\n'}
              Depois rode novamente com: npx expo start -c
            </Text>
          </Card>
        )}

        <View style={styles.divider} />

        {/* Importar de fonte gratuita */}
        <Text style={styles.sectionTitle}>Importar liga (sem token)</Text>
        <Text style={styles.hint}>
          TheSportsDB — alternativa sem cadastro (traz ~30 jogos recentes/próximos).
        </Text>
        <View style={styles.leagueGrid}>
          {POPULAR_LEAGUES.map((l) => (
            <Pressable
              key={l.id}
              style={styles.leagueChip}
              onPress={() => doImport(l.id)}
              disabled={!!importing}
            >
              {importing === l.id ? (
                <Text style={styles.leagueChipText}>Importando…</Text>
              ) : (
                <Text style={styles.leagueChipText}>{l.name}</Text>
              )}
            </Pressable>
          ))}
        </View>
        <Input
          label="Ou importe por ID de liga do TheSportsDB"
          placeholder="Ex: 4351"
          keyboardType="number-pad"
          value={customId}
          onChangeText={setCustomId}
        />
        <Button
          title="Importar por ID"
          variant="secondary"
          onPress={() => doImport(customId.trim())}
          loading={importing === customId.trim() && !!customId}
        />

        {/* Criar manual */}
        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>Criar competição na mão</Text>
        <Text style={styles.hint}>
          Para algo que não está na fonte. Depois você adiciona os jogos um a um.
        </Text>
        <Input label="Nome" placeholder="Ex: Copa da Firma" value={newName} onChangeText={setNewName} />
        <Input
          label="Temporada"
          placeholder="Ex: 2026"
          value={newSeason}
          onChangeText={setNewSeason}
        />
        <Button title="Criar competição" onPress={createManual} loading={creating} />

        {/* Lista existente */}
        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>Competições cadastradas</Text>
        {competitions.isLoading ? (
          <Loading />
        ) : competitions.data && competitions.data.length > 0 ? (
          competitions.data.map((c: Competition) => (
            <Card
              key={c.id}
              onPress={() => router.push(`/admin/competition/${c.id}`)}
              style={styles.compRow}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.compName}>{c.name}</Text>
                <Text style={styles.compMeta}>
                  Temporada {c.season || '—'} · {c.sourceProvider}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Card>
          ))
        ) : (
          <Text style={styles.hint}>Nenhuma competição ainda. Importe ou crie acima.</Text>
        )}
      </ScrollView>
    </View>
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
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.xs,
  },
  hint: { color: colors.textSecondary, fontSize: fontSize.sm, marginBottom: spacing.md, lineHeight: 18 },
  leagueGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  leagueChip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  leagueChipText: { color: colors.textPrimary, fontSize: fontSize.sm },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xl },
  compRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  compName: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  compMeta: { color: colors.textSecondary, fontSize: fontSize.xs },
});
