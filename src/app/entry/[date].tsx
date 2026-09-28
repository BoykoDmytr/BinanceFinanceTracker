import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
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

import { Btn, Field } from '../../components/ui';
import { useData } from '../../lib/data-context';
import { addDays, dateHumanWD, todayISO } from '../../lib/format';
import { colors, spacing } from '../../lib/theme';

function parseNum(s: string, allowNegative = false): number {
  const n = Number(s.replace(',', '.').replace(/\s/g, ''));
  if (!Number.isFinite(n)) return 0;
  return allowNegative || n >= 0 ? n : 0;
}

function numToStr(n: number): string {
  return n === 0 ? '' : String(n);
}

export default function EntryForm() {
  const params = useLocalSearchParams<{ date: string }>();
  const date = typeof params.date === 'string' ? params.date : todayISO();
  const { entries, activeAccount, accounts, saveEntry, removeEntry } = useData();

  const existing = entries.find((e) => e.date === date) ?? null;

  const [volume, setVolume] = useState('');
  const [fee, setFee] = useState('');
  const [pointsPlus, setPointsPlus] = useState('');
  const [pointsMinus, setPointsMinus] = useState('');
  const [dropIncome, setDropIncome] = useState('');
  const [boosterIncome, setBoosterIncome] = useState('');
  const [gasExpense, setGasExpense] = useState('');
  const [comment, setComment] = useState('');

  // при зміні дати (стрілки ‹ ›) — перезаповнити форму
  useEffect(() => {
    setVolume(existing ? numToStr(existing.volume) : '');
    setFee(existing ? numToStr(existing.fee) : '');
    setPointsPlus(existing ? numToStr(existing.pointsPlus) : String(activeAccount.defaultPoints));
    setPointsMinus(existing ? numToStr(existing.pointsMinus) : '');
    setDropIncome(existing ? numToStr(existing.dropIncome) : '');
    setBoosterIncome(existing ? numToStr(existing.boosterIncome) : '');
    setGasExpense(existing ? numToStr(existing.gasExpense) : '');
    setComment(existing ? existing.comment : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const save = () => {
    const entry = {
      date,
      volume: parseNum(volume),
      fee: parseNum(fee),
      pointsPlus: Math.round(parseNum(pointsPlus, true)),
      pointsMinus: Math.round(parseNum(pointsMinus, true)),
      dropIncome: parseNum(dropIncome),
      boosterIncome: parseNum(boosterIncome),
      gasExpense: parseNum(gasExpense),
      comment: comment.trim(),
    };
    const doSave = () => {
      saveEntry(entry);
      router.back();
    };
    // захист від випадкового «порожнього» дня, який непомітно додасть бали
    const noData =
      entry.volume === 0 &&
      entry.fee === 0 &&
      entry.dropIncome === 0 &&
      entry.boosterIncome === 0 &&
      entry.gasExpense === 0 &&
      entry.pointsMinus === 0 &&
      entry.comment === '';
    if (noData && !existing) {
      Alert.alert(
        'Порожній запис',
        `У записі немає жодних даних, але він додасть +${entry.pointsPlus} балів. Зберегти все одно?`,
        [
          { text: 'Скасувати', style: 'cancel' },
          { text: 'Зберегти', onPress: doSave },
        ]
      );
      return;
    }
    doSave();
  };

  const confirmDelete = () => {
    Alert.alert('Видалити запис?', `Запис за ${dateHumanWD(date)} буде видалено.`, [
      { text: 'Скасувати', style: 'cancel' },
      {
        text: 'Видалити',
        style: 'destructive',
        onPress: () => {
          removeEntry(date);
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
      <Stack.Screen options={{ title: existing ? 'Редагувати день' : 'Новий запис' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.dateRow}>
          <TouchableOpacity style={styles.dateBtn} onPress={() => router.setParams({ date: addDays(date, -1) })}>
            <Text style={styles.dateBtnText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.dateText}>{dateHumanWD(date)}</Text>
          <TouchableOpacity
            style={[styles.dateBtn, date >= todayISO() && { opacity: 0.3 }]}
            disabled={date >= todayISO()}
            onPress={() => router.setParams({ date: addDays(date, 1) })}
          >
            <Text style={styles.dateBtnText}>›</Text>
          </TouchableOpacity>
        </View>

        {accounts.length > 1 ? (
          <Text style={styles.account} numberOfLines={1}>
            Акаунт: <Text style={styles.accountName}>{activeAccount.name}</Text>
          </Text>
        ) : null}

        <Field
          label="Обсяг торгівлі, $"
          value={volume}
          onChangeText={setVolume}
          keyboardType="decimal-pad"
          placeholder="0"
        />
        <Field
          label="Комісія, $"
          value={fee}
          onChangeText={setFee}
          keyboardType="decimal-pad"
          placeholder="0"
        />
        <View style={styles.twoCol}>
          <View style={{ flex: 1 }}>
            <Field
              label="Бали +"
              value={pointsPlus}
              onChangeText={setPointsPlus}
              keyboardType="number-pad"
              placeholder="0"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Бали −"
              value={pointsMinus}
              onChangeText={setPointsMinus}
              keyboardType="number-pad"
              placeholder="0"
            />
          </View>
        </View>
        <View style={styles.twoCol}>
          <View style={{ flex: 1 }}>
            <Field
              label="Дохід з дропу, $"
              value={dropIncome}
              onChangeText={setDropIncome}
              keyboardType="decimal-pad"
              placeholder="0"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Дохід з бустерів, $"
              value={boosterIncome}
              onChangeText={setBoosterIncome}
              keyboardType="decimal-pad"
              placeholder="0"
            />
          </View>
        </View>
        <Field
          label="Витрати (газ/фі), $"
          value={gasExpense}
          onChangeText={setGasExpense}
          keyboardType="decimal-pad"
          placeholder="0"
        />
        <Field
          label="Коментар"
          value={comment}
          onChangeText={setComment}
          placeholder="(+)booster …"
          multiline
        />

        <Btn title="Зберегти" onPress={save} style={{ marginTop: spacing.s }} />
        {existing ? (
          <Btn
            title="Видалити запис"
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
  dateText: { color: colors.text, fontSize: 17, fontWeight: '800' },
  twoCol: { flexDirection: 'row', gap: spacing.m },
  account: {
    color: colors.sub,
    fontSize: 13,
    textAlign: 'center',
    marginTop: -spacing.s,
    marginBottom: spacing.l,
  },
  accountName: { color: colors.gold, fontWeight: '800' },
});
