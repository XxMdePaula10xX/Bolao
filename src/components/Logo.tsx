import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontWeight } from '@/theme';

/**
 * Logo do Bolão Flex feito puramente com Views/Text (sem precisar de
 * arquivos de imagem ou biblioteca de SVG). É um "escudo" com o placar
 * "2x1" em dourado — o conceito recomendado no PRD (seção 15).
 *
 * Quando você tiver um logo definitivo (PNG/SVG), basta trocar este
 * componente por um <Image /> ou <SvgXml />.
 */
export function Logo({ size = 72 }: { size?: number }) {
  return (
    <View
      style={[
        styles.shield,
        {
          width: size,
          height: size * 1.12,
          borderRadius: size * 0.22,
          borderBottomLeftRadius: size * 0.5,
          borderBottomRightRadius: size * 0.5,
        },
      ]}
    >
      <Text style={[styles.score, { fontSize: size * 0.34 }]}>
        2<Text style={styles.x}>x</Text>1
      </Text>
      <View style={[styles.bar, { width: size * 0.4 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  shield: {
    backgroundColor: colors.greenDark,
    borderWidth: 2.5,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  score: { color: colors.gold, fontWeight: fontWeight.extrabold, letterSpacing: 1 },
  x: { color: colors.offWhite },
  bar: { height: 3, backgroundColor: colors.greenMedium, borderRadius: 2 },
});
