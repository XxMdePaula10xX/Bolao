import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Screen, Title, Subtitle, Input, Loading, EmptyState, Card } from '@/components/ui';
import { PoolCard } from '@/features/pools/PoolCard';
import { listPublicPools } from '@/services/firebase/pools';
import { Pool } from '@/types';
import { spacing } from '@/theme';

export default function ExploreScreen() {
  const [search, setSearch] = useState('');
  const pools = useQuery({ queryKey: ['publicPools'], queryFn: listPublicPools });

  const filtered = useMemo(() => {
    const data = pools.data ?? [];
    if (!search.trim()) return data;
    const term = search.toLowerCase();
    return data.filter(
      (p: Pool) =>
        p.name.toLowerCase().includes(term) ||
        (p.competitionName ?? '').toLowerCase().includes(term)
    );
  }, [pools.data, search]);

  return (
    <Screen scroll>
      <Title>Explorar</Title>
      <Subtitle>Descubra bolões públicos e oficiais para participar.</Subtitle>

      <View style={styles.searchWrap}>
        <Input
          placeholder="Buscar por nome ou competição..."
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
      </View>

      {pools.isLoading ? (
        <Loading />
      ) : filtered.length > 0 ? (
        filtered.map((p: Pool) => <PoolCard key={p.id} pool={p} />)
      ) : (
        <Card>
          <EmptyState
            icon="🔍"
            title="Nenhum bolão público encontrado"
            message="Que tal criar o primeiro? Toque em Criar bolão na Home."
          />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchWrap: { marginBottom: spacing.sm },
});
