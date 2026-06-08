import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Screen, Input, Button } from '@/components/ui';
import { Logo } from '@/components/Logo';
import { loginWithEmail, resetPassword, authErrorMessage } from '@/services/firebase/auth';
import { colors, spacing, fontSize, fontWeight } from '@/theme';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setError(null);
    if (!email || !password) {
      setError('Preencha e-mail e senha.');
      return;
    }
    setLoading(true);
    try {
      await loginWithEmail(email.trim(), password);
      // O layout raiz detecta o login e redireciona automaticamente.
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot() {
    if (!email) {
      Alert.alert('Recuperar senha', 'Digite seu e-mail no campo acima primeiro.');
      return;
    }
    try {
      await resetPassword(email.trim());
      Alert.alert('Pronto!', 'Enviamos um link de recuperação para seu e-mail.');
    } catch (e) {
      Alert.alert('Ops', authErrorMessage(e));
    }
  }

  return (
    <Screen scroll>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Logo size={84} />
          <Text style={styles.brand}>BOLÃO FLEX</Text>
          <Text style={styles.tagline}>Bolões customizáveis, sem planilha.</Text>
        </View>

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
          placeholder="••••••••"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          error={error}
        />

        <Text style={styles.forgot} onPress={handleForgot}>
          Esqueci minha senha
        </Text>

        <Button title="Entrar" onPress={handleLogin} loading={loading} />

        <View style={styles.footer}>
          <Text style={styles.footerText}>Ainda não tem conta? </Text>
          <Link href="/(auth)/register" style={styles.link}>
            Criar conta
          </Link>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', marginVertical: spacing.xxl, gap: spacing.sm },
  brand: {
    color: colors.offWhite,
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.extrabold,
    letterSpacing: 2,
  },
  tagline: { color: colors.textSecondary, fontSize: fontSize.sm },
  forgot: {
    color: colors.gold,
    fontSize: fontSize.sm,
    textAlign: 'right',
    marginBottom: spacing.lg,
  },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
  footerText: { color: colors.textSecondary },
  link: { color: colors.gold, fontWeight: fontWeight.bold },
});
