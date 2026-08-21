import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '../lib/theme';

export function Screen({
  title,
  subtitle,
  actionLabel,
  onAction,
  children,
  scroll = true,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
  scroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const header = (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <TouchableOpacity style={styles.action} onPress={onAction} activeOpacity={0.8}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  if (!scroll) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + spacing.m }]}>
        {header}
        <View style={{ flex: 1 }}>{children}</View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.m }]}>
      {header}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.l,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.m,
  },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  subtitle: { color: colors.sub, fontSize: 13, marginTop: 2 },
  action: {
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  actionText: { color: '#1a1500', fontWeight: '800', fontSize: 14 },
});
