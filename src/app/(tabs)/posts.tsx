import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Screen } from '../../components/screen';
import { Chip, EmptyState } from '../../components/ui';
import { useData } from '../../lib/data-context';
import { dateHuman, toISODate } from '../../lib/format';
import { colors, radius, spacing } from '../../lib/theme';

export default function Posts() {
  const { posts } = useData();

  return (
    <Screen title="Пости" actionLabel="+ Новий" onAction={() => router.push('/post/new')}>
      {posts.length === 0 ? (
        <EmptyState
          emoji="📝"
          text={
            'Тут живуть заготовки постів.\nНапиши чернетку, прив’яжи нагадування —\nі запостиш одним тапом, коли прийде час.'
          }
        />
      ) : (
        posts.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={styles.row}
            onPress={() => router.push(`/post/${p.id}`)}
            activeOpacity={0.7}
          >
            <View style={styles.rowHeader}>
              <Text style={styles.title} numberOfLines={1}>
                {p.title}
              </Text>
              {p.status === 'published' ? (
                <Chip text="опубліковано" color={colors.green} bg={colors.greenDim} />
              ) : (
                <Chip text="чернетка" color={colors.gold} bg={colors.goldDim + '33'} />
              )}
            </View>
            {p.content ? (
              <Text style={styles.preview} numberOfLines={2}>
                {p.content}
              </Text>
            ) : null}
            <Text style={styles.date}>Оновлено {dateHuman(toISODate(new Date(p.updatedAt)), true)}</Text>
          </TouchableOpacity>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.l,
    padding: spacing.l,
    marginBottom: spacing.s,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    marginBottom: 6,
  },
  title: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 },
  preview: { color: colors.sub, fontSize: 13, lineHeight: 18 },
  date: { color: colors.faint, fontSize: 11, marginTop: 8 },
});
