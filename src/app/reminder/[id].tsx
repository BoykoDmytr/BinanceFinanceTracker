import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Btn, Field, TimeStepper } from '../../components/ui';
import { useData } from '../../lib/data-context';
import { addDays, dateHumanWD, todayISO } from '../../lib/format';
import { colors, radius, spacing } from '../../lib/theme';
import type { ReminderKind } from '../../lib/types';

const WEEKDAYS_UK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const KINDS: { key: ReminderKind; label: string }[] = [
  { key: 'daily', label: 'Щодня' },
  { key: 'weekly', label: 'По днях' },
  { key: 'once', label: 'Разово' },
];

export default function ReminderEditor() {
  const params = useLocalSearchParams<{ id: string; postId?: string }>();
  const isNew = params.id === 'new';
  const { reminders, posts, addReminder, editReminder, removeReminder } = useData();

  const existing = isNew ? null : (reminders.find((r) => r.id === Number(params.id)) ?? null);
  const prefillPost =
    isNew && params.postId ? (posts.find((p) => p.id === Number(params.postId)) ?? null) : null;

  const [title, setTitle] = useState(
    existing?.title ?? (prefillPost ? `Запостити: ${prefillPost.title}` : '')
  );
  const [body, setBody] = useState(existing?.body ?? '');
  const [kind, setKind] = useState<ReminderKind>(existing?.kind ?? (prefillPost ? 'once' : 'daily'));
  const [time, setTime] = useState(existing?.time ?? '12:00');
  const [weekdays, setWeekdays] = useState<number[]>(existing?.weekdays ?? []);
  const [date, setDate] = useState(existing?.date || todayISO());

  const postId = existing?.postId ?? prefillPost?.id ?? null;
  const linkedPost = postId ? (posts.find((p) => p.id === postId) ?? null) : null;

  const toggleWeekday = (d: number) => {
    setWeekdays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  };

  const save = async () => {
    const t = title.trim();
    if (!t) {
      Alert.alert('Порожня назва', 'Введи текст нагадування.');
      return;
    }
    if (kind === 'weekly' && weekdays.length === 0) {
      Alert.alert('Немає днів', 'Обери хоча б один день тижня.');
      return;
    }
    const data = {
      title: t,
      body: body.trim(),
      kind,
      time,
      weekdays: kind === 'weekly' ? weekdays : [],
      date: kind === 'once' ? date : '',
      enabled: true,
      postId,
    };
    if (existing) {
      await editReminder({ ...existing, ...data });
    } else {
      await addReminder(data);
    }
    router.back();
  };

  const confirmDelete = () => {
    if (!existing) return;
    Alert.alert('Видалити нагадування?', existing.title, [
      { text: 'Скасувати', style: 'cancel' },
      {
        text: 'Видалити',
        style: 'destructive',
        onPress: async () => {
          await removeReminder(existing.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: isNew ? 'Нове нагадування' : 'Нагадування' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Field label="Назва" value={title} onChangeText={setTitle} placeholder="Запостити пост" />
        <Field
          label="Текст (необов'язково)"
          value={body}
          onChangeText={setBody}
          placeholder="Деталі нагадування"
          multiline
        />

        <Text style={styles.label}>Розклад</Text>
        <View style={styles.kindRow}>
          {KINDS.map((k) => (
            <TouchableOpacity
              key={k.key}
              style={[styles.kindBtn, kind === k.key && styles.kindBtnActive]}
              onPress={() => setKind(k.key)}
            >
              <Text style={[styles.kindText, kind === k.key && styles.kindTextActive]}>
                {k.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {kind === 'weekly' ? (
          <View style={styles.weekRow}>
            {WEEKDAYS_UK.map((label, i) => {
              const d = i + 1;
              const on = weekdays.includes(d);
              return (
                <TouchableOpacity
                  key={d}
                  style={[styles.dayBtn, on && styles.dayBtnActive]}
                  onPress={() => toggleWeekday(d)}
                >
                  <Text style={[styles.dayText, on && styles.dayTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        {kind === 'once' ? (
          <View style={styles.dateRow}>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setDate(addDays(date, -1))}>
              <Text style={styles.dateBtnText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.dateText}>{dateHumanWD(date)}</Text>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setDate(addDays(date, 1))}>
              <Text style={styles.dateBtnText}>›</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <Text style={styles.label}>Час</Text>
        <View style={{ alignItems: 'flex-start', marginBottom: spacing.l }}>
          <TimeStepper value={time} onChange={setTime} />
        </View>

        {linkedPost ? (
          <View style={styles.postLink}>
            <Text style={styles.postLinkLabel}>Прив'язаний пост</Text>
            <Text style={styles.postLinkTitle}>📝 {linkedPost.title}</Text>
            <Text style={styles.postLinkHint}>
              Тап по сповіщенню відкриє цей пост — скопіюєш і запостиш за секунду.
            </Text>
          </View>
        ) : null}

        <Btn title="Зберегти" onPress={save} />
        {existing ? (
          <Btn
            title="Видалити"
            onPress={confirmDelete}
            tone="danger"
            style={{ marginTop: spacing.m }}
          />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.l, paddingBottom: 60 },
  label: { color: colors.sub, fontSize: 13, marginBottom: 8 },
  kindRow: { flexDirection: 'row', gap: spacing.s, marginBottom: spacing.l },
  kindBtn: {
    flex: 1,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.m,
    paddingVertical: 10,
    alignItems: 'center',
  },
  kindBtnActive: { backgroundColor: colors.goldDim + '44', borderColor: colors.gold },
  kindText: { color: colors.sub, fontWeight: '700', fontSize: 13 },
  kindTextActive: { color: colors.gold },
  weekRow: { flexDirection: 'row', gap: 6, marginBottom: spacing.l },
  dayBtn: {
    flex: 1,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.s,
    paddingVertical: 9,
    alignItems: 'center',
  },
  dayBtnActive: { backgroundColor: colors.goldDim + '44', borderColor: colors.gold },
  dayText: { color: colors.sub, fontSize: 12, fontWeight: '700' },
  dayTextActive: { color: colors.gold },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.l,
  },
  dateBtn: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    width: 44,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateBtnText: { color: colors.gold, fontSize: 22, fontWeight: '800', marginTop: -2 },
  dateText: { color: colors.text, fontSize: 16, fontWeight: '800' },
  postLink: {
    backgroundColor: colors.blueDim,
    borderColor: colors.blue,
    borderWidth: 1,
    borderRadius: radius.m,
    padding: spacing.l,
    marginBottom: spacing.l,
  },
  postLinkLabel: { color: colors.sub, fontSize: 11, marginBottom: 4 },
  postLinkTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  postLinkHint: { color: colors.sub, fontSize: 12, marginTop: 6, lineHeight: 16 },
});
