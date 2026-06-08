import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Input, Button, Card, Loading } from '@/components/ui';
import { listCompetitions } from '@/services/firebase/matches';
import { createPool } from '@/services/firebase/pools';
import { useAuthStore } from '@/store/authStore';
import { defaultSettings, templates } from '@/lib/poolDefaults';
import { PoolSettings, PoolTemplate, Competition } from '@/types';
import { colors, spacing, fontSize, fontWeight, radius } from '@/theme';

const STEPS = ['Básico', 'Competição', 'Formato', 'Pontuação', 'Revisão'];

export default function CreatePoolScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { profile } = useAuthStore();
  const competitions = useQuery({ queryKey: ['competitions'], queryFn: listCompetitions });

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Estado do formulário
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [prize, setPrize] = useState('');
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [template, setTemplate] = useState<PoolTemplate>('classic');
  const [settings, setSettings] = useState<PoolSettings>(defaultSettings);

  function applyTemplate(t: PoolTemplate) {
    setTemplate(t);
    setSettings(templates[t].apply(defaultSettings));
  }

  function updateScoring(key: keyof PoolSettings['scoring'], value: number) {
    setSettings((s) => ({ ...s, scoring: { ...s.scoring, [key]: value } }));
  }

  function canAdvance(): boolean {
    if (step === 0) return name.trim().length >= 3;
    if (step === 1) return !!competition;
    return true;
  }

  async function handlePublish() {
    if (!profile || !competition) return;
    setSaving(true);
    try {
      const pool = await createPool(profile, {
        name: name.trim(),
        description: description.trim(),
        isPublic,
        competitionId: competition.id,
        competitionName: competition.name,
        settings,
        prize: prize.trim(),
      });
      qc.invalidateQueries({ queryKey: ['myPools'] });
      qc.invalidateQueries({ queryKey: ['publicPools'] });
      router.replace(`/pool/${pool.id}`);
    } catch (e) {
      console.error(e);
      setSaving(false);
      Alert.alert(
        'Não foi possível criar o bolão',
        'Verifique sua conexão e se as regras do Firestore foram publicadas. Tente novamente.'
      );
    }
  }

  return (
    <View style={styles.container}>
      {/* Cabeçalho com progresso */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.offWhite} />
        </Pressable>
        <Text style={styles.headerTitle}>Criar bolão</Text>
        <View style={{ width: 26 }} />
      </View>
      <Stepper step={step} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* PASSO 1 - Básico */}
        {step === 0 && (
          <View>
            <StepTitle title="Informações básicas" subtitle="Como o bolão vai se chamar?" />
            <Input
              label="Nome do bolão"
              placeholder="Ex: Bolão da Firma 2026"
              value={name}
              onChangeText={setName}
            />
            <Input
              label="Descrição (opcional)"
              placeholder="Conte do que se trata"
              value={description}
              onChangeText={setDescription}
              multiline
            />
            <Card style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>Bolão público</Text>
                <Text style={styles.switchHint}>
                  {isPublic
                    ? 'Aparece na aba Explorar para qualquer um entrar.'
                    : 'Só entra quem tiver o código de convite.'}
                </Text>
              </View>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ true: colors.greenMedium, false: colors.border }}
                thumbColor={isPublic ? colors.gold : colors.grayMedium}
              />
            </Card>
          </View>
        )}

        {/* PASSO 2 - Competição */}
        {step === 1 && (
          <View>
            <StepTitle title="Competição" subtitle="Sobre qual campeonato é o bolão?" />
            {competitions.isLoading ? (
              <Loading />
            ) : competitions.data && competitions.data.length > 0 ? (
              competitions.data.map((c: Competition) => (
                <Card
                  key={c.id}
                  onPress={() => setCompetition(c)}
                  style={[
                    styles.optionCard,
                    competition?.id === c.id && styles.optionCardActive,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionTitle}>{c.name}</Text>
                    <Text style={styles.optionHint}>Temporada {c.season}</Text>
                  </View>
                  {competition?.id === c.id && (
                    <Ionicons name="checkmark-circle" size={24} color={colors.gold} />
                  )}
                </Card>
              ))
            ) : (
              <Card>
                <Text style={styles.muted}>
                  Nenhuma competição cadastrada ainda. Um admin precisa cadastrar
                  competições no Firestore (veja o README, seção "Dados de exemplo").
                </Text>
              </Card>
            )}
          </View>
        )}

        {/* PASSO 3 - Formato / Template */}
        {step === 2 && (
          <View>
            <StepTitle
              title="Formato do bolão"
              subtitle="Escolha um modelo pronto. Dá pra ajustar depois."
            />
            {(Object.keys(templates) as PoolTemplate[]).map((t) => (
              <Card
                key={t}
                onPress={() => applyTemplate(t)}
                style={[styles.optionCard, template === t && styles.optionCardActive]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>{templates[t].label}</Text>
                  <Text style={styles.optionHint}>{templates[t].description}</Text>
                </View>
                {template === t && (
                  <Ionicons name="checkmark-circle" size={24} color={colors.gold} />
                )}
              </Card>
            ))}

            <Card style={{ marginTop: spacing.md, gap: spacing.sm }}>
              <Text style={styles.switchLabel}>Módulos ativos</Text>
              <ModuleLine label="Ranking geral" active={settings.modules.overallRanking} />
              <ModuleLine label="Liga (pontos corridos)" active={settings.modules.league} />
              <ModuleLine label="Copa (mata-mata)" active={settings.modules.cup} />
              <ModuleLine label="Longo prazo" active={settings.modules.longTermPredictions} />
            </Card>
          </View>
        )}

        {/* PASSO 4 - Pontuação */}
        {step === 3 && (
          <View>
            <StepTitle
              title="Pontuação"
              subtitle="Quantos pontos vale cada tipo de acerto?"
            />
            <Stepper2
              label="Placar exato"
              value={settings.scoring.exactScorePoints}
              onChange={(v) => updateScoring('exactScorePoints', v)}
            />
            <Stepper2
              label="Acertar o vencedor"
              value={settings.scoring.winnerPoints}
              onChange={(v) => updateScoring('winnerPoints', v)}
            />
            <Stepper2
              label="Acertar o empate"
              value={settings.scoring.drawPoints}
              onChange={(v) => updateScoring('drawPoints', v)}
            />
            <Input
              label="Premiação (opcional)"
              placeholder="Ex: O último paga a pizza 🍕"
              value={prize}
              onChangeText={setPrize}
            />
          </View>
        )}

        {/* PASSO 5 - Revisão */}
        {step === 4 && (
          <View>
            <StepTitle title="Revisão" subtitle="Confira tudo antes de publicar." />
            <Card style={{ gap: spacing.sm }}>
              <ReviewLine label="Nome" value={name} />
              <ReviewLine label="Tipo" value={isPublic ? 'Público' : 'Privado'} />
              <ReviewLine label="Competição" value={competition?.name ?? '—'} />
              <ReviewLine label="Formato" value={templates[template].label} />
              <ReviewLine
                label="Placar exato"
                value={`${settings.scoring.exactScorePoints} pts`}
              />
              <ReviewLine label="Vencedor" value={`${settings.scoring.winnerPoints} pts`} />
              <ReviewLine label="Empate" value={`${settings.scoring.drawPoints} pts`} />
              {prize ? <ReviewLine label="Premiação" value={prize} /> : null}
            </Card>
            <Text style={styles.note}>
              ℹ️ O regulamento será gerado automaticamente a partir dessas regras.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Rodapé com navegação */}
      <View style={styles.footer}>
        {step > 0 && (
          <Button
            title="Voltar"
            variant="outline"
            onPress={() => setStep((s) => s - 1)}
            fullWidth={false}
            style={{ flex: 1 }}
          />
        )}
        {step < STEPS.length - 1 ? (
          <Button
            title="Continuar"
            onPress={() => setStep((s) => s + 1)}
            disabled={!canAdvance()}
            fullWidth={false}
            style={{ flex: 1 }}
          />
        ) : (
          <Button
            title="Publicar bolão"
            onPress={handlePublish}
            loading={saving}
            fullWidth={false}
            style={{ flex: 1 }}
          />
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Componentes auxiliares locais
// ---------------------------------------------------------------------------
function Stepper({ step }: { step: number }) {
  return (
    <View style={styles.stepperRow}>
      {STEPS.map((label, i) => (
        <View key={label} style={styles.stepItem}>
          <View
            style={[
              styles.stepDot,
              i === step && styles.stepDotActive,
              i < step && styles.stepDotDone,
            ]}
          >
            <Text style={[styles.stepNum, i <= step && { color: colors.grayDark }]}>
              {i < step ? '✓' : i + 1}
            </Text>
          </View>
          <Text style={[styles.stepLabel, i === step && { color: colors.gold }]}>
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function StepTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={styles.stepTitle}>{title}</Text>
      <Text style={styles.stepSubtitle}>{subtitle}</Text>
    </View>
  );
}

function Stepper2({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <Card style={styles.counterRow}>
      <Text style={styles.switchLabel}>{label}</Text>
      <View style={styles.counter}>
        <Pressable
          style={styles.counterBtn}
          onPress={() => onChange(Math.max(0, value - 1))}
        >
          <Ionicons name="remove" size={20} color={colors.offWhite} />
        </Pressable>
        <Text style={styles.counterValue}>{value}</Text>
        <Pressable style={styles.counterBtn} onPress={() => onChange(value + 1)}>
          <Ionicons name="add" size={20} color={colors.offWhite} />
        </Pressable>
      </View>
    </Card>
  );
}

function ModuleLine({ label, active }: { label: string; active: boolean }) {
  return (
    <View style={styles.moduleLine}>
      <Ionicons
        name={active ? 'checkmark-circle' : 'close-circle'}
        size={18}
        color={active ? colors.success : colors.textMuted}
      />
      <Text style={[styles.moduleLabel, !active && { color: colors.textMuted }]}>
        {label}
      </Text>
    </View>
  );
}

function ReviewLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewLine}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue}>{value}</Text>
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
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  stepItem: { alignItems: 'center', flex: 1, gap: 4 },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  stepDotDone: { backgroundColor: colors.greenMedium, borderColor: colors.greenMedium },
  stepNum: { color: colors.textSecondary, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  stepLabel: { color: colors.textMuted, fontSize: 10 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  stepTitle: { color: colors.textPrimary, fontSize: fontSize.xl, fontWeight: fontWeight.extrabold },
  stepSubtitle: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 4 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  switchLabel: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  switchHint: { color: colors.textSecondary, fontSize: fontSize.xs, marginTop: 2 },
  optionCard: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  optionCardActive: { borderColor: colors.gold },
  optionTitle: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  optionHint: { color: colors.textSecondary, fontSize: fontSize.xs, marginTop: 2 },
  muted: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20 },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  counter: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  counterBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.greenMedium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterValue: {
    color: colors.gold,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.extrabold,
    minWidth: 28,
    textAlign: 'center',
  },
  moduleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  moduleLabel: { color: colors.textPrimary, fontSize: fontSize.sm },
  reviewLine: { flexDirection: 'row', justifyContent: 'space-between' },
  reviewLabel: { color: colors.textSecondary, fontSize: fontSize.sm },
  reviewValue: { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  note: { color: colors.textSecondary, fontSize: fontSize.xs, marginTop: spacing.md, lineHeight: 18 },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
