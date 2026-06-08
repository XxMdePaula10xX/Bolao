import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Input, Button, Card } from '@/components/ui';
import { findPoolByInviteCode, joinPool } from '@/services/firebase/pools';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing, fontSize, fontWeight } from '@/theme';

export default function JoinScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { profile } = useAuthStore();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    setError(null);
    if (!profile) return;
    if (code.trim().length < 4) {
      setError('Digite o código de convite completo.');
      return;
    }
    setLoading(true);
    try {
      const pool = await findPoolByInviteCode(code.trim());
      if (!pool) {
        setError('Bolão não encontrado. Confira o código.');
        return;
      }
      await joinPool(pool, profile);
      qc.invalidateQueries({ queryKey: ['myPools'] });
      router.replace(`/pool/${pool.id}`);
    } catch (e) {
      console.error(e);
      setError('Não foi possível entrar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.offWhite} />
        </Pressable>
        <Text style={styles.headerTitle}>Entrar em um bolão</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.content}>
        <Card style={{ alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg }}>
          <Ionicons name="key" size={40} color={colors.gold} />
          <Text style={styles.title}>Tem um código de convite?</Text>
          <Text style={styles.subtitle}>
            Peça o código ao organizador do bolão e digite abaixo.
          </Text>
        </Card>

        <Input
          label="Código de convite"
          placeholder="Ex: 7K2D9X"
          autoCapitalize="characters"
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          error={error}
        />
        <Button title="Entrar no bolão" onPress={handleJoin} loading={loading} />
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
  content: { padding: spacing.lg },
  title: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  subtitle: { color: colors.textSecondary, fontSize: fontSize.sm, textAlign: 'center' },
});
