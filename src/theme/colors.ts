/**
 * Paleta de cores do Bolão Flex (definida no PRD - seção 14 Branding).
 * Mantemos tudo centralizado aqui para o app ter identidade visual
 * consistente. Para mudar a cara do app, mude só este arquivo.
 */
export const colors = {
  // Cores principais
  greenDark: '#0D3B2E',
  greenMedium: '#136F4A',
  gold: '#D4AF37',
  offWhite: '#F5F4EF',
  grayDark: '#1C1F22',
  grayMedium: '#8E98A0',

  // Cores auxiliares
  success: '#22C55E',
  error: '#EF4444',
  highlight: '#F59E0B',
  info: '#3B82F6',

  // Tons utilitários derivados (cards, bordas, fundos)
  background: '#0D3B2E',
  surface: '#11362A',
  surfaceElevated: '#16463499',
  card: '#13402F',
  border: '#1F5A41',
  textPrimary: '#F5F4EF',
  textSecondary: '#A9B4AD',
  textMuted: '#8E98A0',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.55)',
} as const;

export type AppColor = keyof typeof colors;
