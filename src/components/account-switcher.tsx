import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useData } from '../lib/data-context';
import { colors, radius, spacing } from '../lib/theme';

/**
 * Рядок чипів для швидкого перемикання активного акаунта. Крапка на чипі —
 * чи є сьогодні прокрут (зелена) або ще ні (червона). З одним акаунтом не
 * показується зовсім.
 */
export function AccountSwitcher() {
  const { overview, activeAccount, setActiveAccount } = useData();
  if (overview.length < 2) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      {overview.map(({ account, stats }) => {
        const on = account.id === activeAccount.id;
        return (
          <TouchableOpacity
            key={account.id}
            style={[styles.chip, on && styles.chipOn]}
            onPress={() => setActiveAccount(account.id)}
            activeOpacity={0.7}
          >
            <View
              style={[styles.dot, { backgroundColor: stats.todayLogged ? colors.green : colors.red }]}
            />
            <Text style={[styles.text, on && styles.textOn]} numberOfLines={1}>
              {account.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, marginBottom: spacing.m },
  row: { gap: spacing.s },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 200,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.m,
    paddingHorizontal: spacing.m,
    paddingVertical: 8,
  },
  chipOn: { backgroundColor: colors.goldDim + '44', borderColor: colors.gold },
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: { color: colors.sub, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  textOn: { color: colors.gold },
});
