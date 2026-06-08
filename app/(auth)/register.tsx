import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Screen, Input, Button } from '@/components/ui';
import { Logo } from '@/components/Logo';
import { registerWithEmail, authErrorMessage } from '@/services/firebase/auth';
import { colors, spacing, fontSize, fontWeight } from '@/theme';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister() {
    setError(null);
    if (!name.trim()) return setError('Digite seu nome.');
    if (!email.trim()) return setError('Digite seu e-mail.');
    if (password.length < 6) return setError('A senha precisa ter ao menos 6 caracteres.');

    setLoading(true);
    try {
      await registerWithEmail(name.trim(), email.trim(), password);
      // Redirecionamento automático pelo layout raiz.
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Logo size={64} />
          <Text style={styles.title}>Criar conta</Text>
          <Text style={styles.subtitle}>Leva menos de um minuto.</Text>
        </View>

        <Input label="Nome" placeholder="Seu nome" value={name} onChangeText={setName} />
        <Input
          label="E-mail"
          placeholder="voce@email.com"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Input
          label="Senha"
          placeholder="Mínimo 6 caracteres"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          error={error}
        />

        <Button title="Cadastrar" onPress={handleRegister} loading={loading} />

        <View style={styles.footer}>
          <Text style={styles.footerText}>Já tem conta? </Text>
          <Link href="/(auth)/login" style={styles.link}>
            Entrar
          </Link>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', marginVertical: spacing.xl, gap: spacing.xs },
  title: {
    color: colors.offWhite,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.extrabold,
    marginTop: spacing.sm,
  },
  subtitle: { color: colors.textSecondary, fontSize: fontSize.sm },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
  footerText: { color: colors.textSecondary },
  link: { color: colors.gold, fontWeight: fontWeight.bold },
});
