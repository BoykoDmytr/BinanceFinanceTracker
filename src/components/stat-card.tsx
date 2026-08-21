import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../lib/theme';

export function StatCard({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'neutral' | 'gold' | 'green' | 'red' | 'blue';
}) {
  const toneColor =
    tone === 'gold'
      ? colors.gold
      : tone === 'green'
        ? colors.green
        : tone === 'red'
          ? colors.red
          : tone === 'blue'
            ? colors.blue
            : colors.text;
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: toneColor }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.l,
    minWidth: '45%',
  },
  label: { color: colors.sub, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  value: { fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },
  sub: { color: colors.faint, fontSize: 11, marginTop: 4 },
});
