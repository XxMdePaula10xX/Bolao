import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Loading, Card, Button, Input, EmptyState, Avatar } from '@/components/ui';
import { listFeed, createFeedPost } from '@/services/firebase/feed';
import { Pool, UserProfile, FeedPost } from '@/types';
import { formatMatchDate } from '@/lib/utils';
import { colors, spacing, fontSize, fontWeight } from '@/theme';

/**
 * Aba do mural do bolão (seção 6.11). O organizador publica avisos;
 * todos os participantes leem.
 */
export function FeedTab({ pool, user }: { pool: Pool; user: UserProfile }) {
  const qc = useQueryClient();
  const isOwner = pool.ownerId === user.id;
  const feed = useQuery({
    queryKey: ['feed', pool.id],
    queryFn: () => listFeed(pool.id),
  });
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  async function handlePost() {
    if (!text.trim()) return;
    setPosting(true);
    try {
      await createFeedPost(pool.id, user, text);
      setText('');
      qc.invalidateQueries({ queryKey: ['feed', pool.id] });
    } catch (e) {
      console.error(e);
    } finally {
      setPosting(false);
    }
  }

  return (
    <View style={{ gap: spacing.md }}>
      {isOwner ? (
        <Card style={{ gap: spacing.sm }}>
          <Text style={styles.composerLabel}>Publicar um aviso</Text>
          <Input
            placeholder="Escreva algo para o grupo..."
            value={text}
            onChangeText={setText}
            multiline
            style={{ marginBottom: 0, minHeight: 60 }}
          />
          <Button title="Publicar" onPress={handlePost} loading={posting} />
        </Card>
      ) : null}

      {feed.isLoading ? (
        <Loading />
      ) : feed.data && feed.data.length > 0 ? (
        feed.data.map((post: FeedPost) => (
          <Card key={post.id} style={styles.postCard}>
            <View style={styles.postHeader}>
              <Avatar name={post.authorName} size={32} />
              <View style={{ flex: 1 }}>
                <Text style={styles.author}>{post.authorName}</Text>
                <Text style={styles.date}>{formatMatchDate(post.createdAt)}</Text>
              </View>
              {post.type === 'system' ? (
                <Ionicons name="megaphone" size={18} color={colors.gold} />
              ) : null}
            </View>
            <Text style={styles.postText}>{post.text}</Text>
          </Card>
        ))
      ) : (
        <EmptyState
          icon="📰"
          title="Mural vazio"
          message={
            isOwner
              ? 'Publique o primeiro aviso do bolão acima.'
              : 'Ainda não há avisos. Volte mais tarde.'
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  composerLabel: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  postCard: { gap: spacing.sm },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  author: { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  date: { color: colors.textMuted, fontSize: fontSize.xs },
  postText: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20 },
});
