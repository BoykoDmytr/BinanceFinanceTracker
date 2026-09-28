import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

import { Screen } from '../../components/screen';
import { Card, EmptyState, SectionTitle, TimeStepper, ToggleRow } from '../../components/ui';
import { useData } from '../../lib/data-context';
import { dateHuman } from '../../lib/format';
import { colors, radius, spacing } from '../../lib/theme';
import type { Reminder } from '../../lib/types';

const WEEKDAYS_UK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

export function scheduleLabel(r: Reminder): string {
  if (r.kind === 'daily') return `Щодня о ${r.time}`;
  if (r.kind === 'weekly') {
    const days = r.weekdays.map((d) => WEEKDAYS_UK[d - 1]).join(', ');
    return `${days || '—'} о ${r.time}`;
  }
  return r.date ? `${dateHuman(r.date, true)} о ${r.time}` : `Разово о ${r.time}`;
}

export default function Reminders() {
  const { settings, updateSettings, reminders, editReminder, notifGranted, posts, accounts } =
    useData();

  return (
    <Screen
      title="Нагадування"
      actionLabel="+ Нове"
      onAction={() => router.push('/reminder/new')}
    >
      {!notifGranted ? (
        <View style={styles.warn}>
          <Text style={styles.warnTitle}>Сповіщення вимкнені</Text>
          <Text style={styles.warnText}>
            Дозволь сповіщення для Crypto Hornet у налаштуваннях Android, інакше нагадування не
            приходитимуть.
          </Text>
        </View>
      ) : null}

      <SectionTitle>Щоденний прокрут</SectionTitle>
      <Card>
        <ToggleRow
          label="Нагадувати про прокрут"
          hint={
            accounts.length > 1
              ? 'Якщо за сьогодні немає запису хоча б в одному акаунті (крім тих, де нагадування вимкнене в налаштуваннях акаунта)'
              : 'Якщо за сьогодні немає запису в журналі'
          }
          value={settings.spinReminderEnabled}
          onChange={(v) => updateSettings({ ...settings, spinReminderEnabled: v })}
        />
        {settings.spinReminderEnabled ? (
          <>
            <View style={styles.timeRow}>
              <Text style={styles.timeLabel}>Час нагадування</Text>
              <TimeStepper
                value={settings.spinReminderTime}
                onChange={(t) => updateSettings({ ...settings, spinReminderTime: t })}
              />
            </View>
            <ToggleRow
              label="Повторити через 2 години"
              hint="Якщо запису досі немає"
              value={settings.spinReminderRepeat}
              onChange={(v) => updateSettings({ ...settings, spinReminderRepeat: v })}
            />
          </>
        ) : null}
      </Card>

      <SectionTitle>Кастомні</SectionTitle>
      {reminders.length === 0 ? (
        <EmptyState
          emoji="🔕"
          text={'Кастомних нагадувань поки немає.\nНатисни «+ Нове», щоб створити своє.'}
        />
      ) : (
        reminders.map((r) => {
          const post = r.postId ? posts.find((p) => p.id === r.postId) : null;
          return (
            <TouchableOpacity
              key={r.id}
              style={[styles.remRow, !r.enabled && { opacity: 0.55 }]}
              onPress={() => router.push(`/reminder/${r.id}`)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.remTitle}>{r.title}</Text>
                <Text style={styles.remSchedule}>{scheduleLabel(r)}</Text>
                {post ? <Text style={styles.remPost}>📝 {post.title}</Text> : null}
              </View>
              <Switch
                value={r.enabled}
                onValueChange={(v) => editReminder({ ...r, enabled: v })}
                trackColor={{ false: colors.border, true: colors.goldDim }}
                thumbColor={r.enabled ? colors.gold : colors.sub}
              />
            </TouchableOpacity>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  warn: {
    backgroundColor: colors.redDim,
    borderColor: colors.red,
    borderWidth: 1,
    borderRadius: radius.m,
    padding: spacing.l,
    marginBottom: spacing.m,
  },
  warnTitle: { color: colors.red, fontWeight: '800', fontSize: 14 },
  warnText: { color: colors.sub, fontSize: 12, marginTop: 4, lineHeight: 17 },
  timeRow: {
    paddingVertical: spacing.s,
    gap: spacing.s,
  },
  timeLabel: { color: colors.text, fontSize: 15, fontWeight: '600' },
  remRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.l,
    padding: spacing.l,
    marginBottom: spacing.s,
  },
  remTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  remSchedule: { color: colors.gold, fontSize: 12, marginTop: 3 },
  remPost: { color: colors.sub, fontSize: 12, marginTop: 3 },
});
