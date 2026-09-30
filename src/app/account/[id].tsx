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

import { Btn, Field, ToggleRow } from '../../components/ui';
import { correctionFor } from '../../lib/calc';
import { useData } from '../../lib/data-context';
import { dateHuman, money, moneySigned } from '../../lib/format';
import { colors, radius, spacing } from '../../lib/theme';
import type { BalanceAdjustment } from '../../lib/types';

function parseNum(s: string): number | null {
  const n = Number(s.replace(',', '.').replace(/\s/g, ''));
  return s.trim() !== '' && Number.isFinite(n) ? n : null;
}

/** Баланс для поля вводу: до центів, без «хвостів» float. */
function balanceToInput(v: number): string {
  return String(Math.round(v * 100) / 100);
}

export default function AccountEditor() {
  const params = useLocalSearchParams<{ id: string }>();
  const isNew = params.id === 'new';
  const {
    accounts,
    activeAccount,
    overview,
    entriesByAccount,
    adjustmentsByAccount,
    today,
    addAccount,
    editAccount,
    removeAccount,
    setActiveAccount,
    setBalanceAdjustment,
  } = useData();

  const existing = isNew ? null : (accounts.find((a) => a.id === Number(params.id)) ?? null);
  const stats = existing
    ? (overview.find((o) => o.account.id === existing.id)?.stats ?? null)
    : null;
  const corrections = existing ? (adjustmentsByAccount[existing.id] ?? []) : [];
  const todayCorrection = corrections.find((a) => a.date === today)?.amount ?? 0;

  const [name, setName] = useState(existing?.name ?? '');
  const [startBalance, setStartBalance] = useState(String(existing?.startBalance ?? 0));
  const [startPoints, setStartPoints] = useState(String(existing?.startPoints ?? 0));
  // для нового акаунта темп балів беремо з поточного — зазвичай він однаковий
  const [defaultPoints, setDefaultPoints] = useState(
    String(existing?.defaultPoints ?? activeAccount.defaultPoints)
  );
  const [spinReminder, setSpinReminder] = useState(existing?.spinReminder ?? true);
  // Поточний баланс редагується окремо від стартового: різниця пишеться
  // корекцією за сьогодні, тож історія до сьогодні лишається як була.
  // balanceBase — що було в полі спочатку: корекцію робимо, лише якщо поле змінили.
  const [balanceBase, setBalanceBase] = useState(stats ? balanceToInput(stats.balance) : '');
  const [currentBalance, setCurrentBalance] = useState(balanceBase);
  const balanceChanged = !!existing && currentBalance.trim() !== balanceBase.trim();

  const save = () => {
    const n = name.trim();
    if (!n) {
      Alert.alert('Порожня назва', 'Назви акаунт так, щоб було зрозуміло, де він: «Samsung A54», «телефон мами»…');
      return;
    }
    const taken = accounts.some(
      (a) => a.id !== existing?.id && a.name.trim().toLowerCase() === n.toLowerCase()
    );
    if (taken) {
      Alert.alert('Назва вже є', 'Акаунт з такою назвою вже існує — обери іншу, щоб їх не плутати.');
      return;
    }
    const sb = parseNum(startBalance);
    const sp = parseNum(startPoints);
    const dp = parseNum(defaultPoints);
    const target = balanceChanged ? parseNum(currentBalance) : null;
    if (sb === null || sp === null || dp === null || (balanceChanged && target === null)) {
      Alert.alert('Помилка', 'Перевір числа — щось не вдалося прочитати.');
      return;
    }
    const data = {
      name: n,
      startBalance: sb,
      startPoints: Math.round(sp),
      defaultPoints: Math.round(dp),
      spinReminder,
    };
    if (existing) {
      editAccount({ ...existing, ...data });
      if (stats && target !== null) {
        // стартовий баланс міг змінитись у цій самій формі — рахуємо вже від нового
        const balanceNow = stats.balance + (sb - existing.startBalance);
        setBalanceAdjustment(existing.id, today, correctionFor(balanceNow, target, todayCorrection));
      }
    } else {
      // щойно створений акаунт одразу стає активним — його журнал і заповнюватимуть
      setActiveAccount(addAccount(data).id);
    }
    router.back();
  };

  const confirmRemoveCorrection = (a: BalanceAdjustment) => {
    if (!existing || !stats) return;
    Alert.alert(
      'Прибрати корекцію?',
      `Корекцію ${moneySigned(a.amount)} за ${dateHuman(a.date, true)} буде видалено — баланс ` +
        `стане ${money(stats.balance - a.amount)}.`,
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Прибрати',
          style: 'destructive',
          onPress: () => {
            setBalanceAdjustment(existing.id, a.date, 0);
            const next = balanceToInput(stats.balance - a.amount);
            // поле ще не чіпали — показуємо новий баланс, інакше лишаємо введене
            if (!balanceChanged) setCurrentBalance(next);
            setBalanceBase(next);
          },
        },
      ]
    );
  };

  const confirmDelete = () => {
    if (!existing) return;
    const count = (entriesByAccount[existing.id] ?? []).length;
    Alert.alert(
      `Видалити «${existing.name}»?`,
      `Разом з акаунтом буде видалено ${count} записів його журналу. Це не можна скасувати — ` +
        'якщо дані ще потрібні, спершу зроби експорт CSV.',
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Видалити',
          style: 'destructive',
          onPress: () => {
            removeAccount(existing.id);
            router.back();
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: isNew ? 'Новий акаунт' : 'Акаунт' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Field
          label="Назва"
          value={name}
          onChangeText={setName}
          placeholder="Напр.: Samsung A54 / телефон мами"
          maxLength={40}
        />
        <Field
          label="Стартовий баланс, $"
          value={startBalance}
          onChangeText={setStartBalance}
          keyboardType="decimal-pad"
        />
        {existing && stats ? (
          <View style={styles.balanceBox}>
            <Field
              label="Поточний баланс, $"
              value={currentBalance}
              onChangeText={setCurrentBalance}
              keyboardType="decimal-pad"
            />
            <Text style={styles.boxHint}>
              Якщо баланс на Binance розійшовся з журналом (депозит, вивід, зміна курсу) — введи
              фактичний. Різниця запишеться корекцією за сьогодні: стартовий баланс, історія і
              P&L операцій не зміняться. Вводь, коли сьогоднішній прокрут уже записано.
            </Text>
            {corrections.length > 0 ? (
              <View style={styles.corrections}>
                <Text style={styles.correctionsTitle}>Корекції балансу</Text>
                {[...corrections].reverse().map((a) => (
                  <View key={a.date} style={styles.correctionRow}>
                    <Text style={styles.correctionDate}>{dateHuman(a.date, true)}</Text>
                    <Text
                      style={[
                        styles.correctionAmount,
                        { color: a.amount >= 0 ? colors.green : colors.red },
                      ]}
                    >
                      {moneySigned(a.amount)}
                    </Text>
                    <TouchableOpacity
                      style={styles.correctionDel}
                      onPress={() => confirmRemoveCorrection(a)}
                      hitSlop={8}
                    >
                      <Text style={styles.correctionDelText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
        <Field
          label="Стартові бали (вже накопичені)"
          value={startPoints}
          onChangeText={setStartPoints}
          keyboardType="number-pad"
        />
        <Field
          label="Бали за день (за замовчуванням)"
          value={defaultPoints}
          onChangeText={setDefaultPoints}
          keyboardType="number-pad"
        />
        <ToggleRow
          label="Нагадувати про прокрут"
          hint="Вимкни для акаунта, який більше не крутиш — тоді він не тригерить щоденне нагадування"
          value={spinReminder}
          onChange={setSpinReminder}
        />
        <Text style={styles.hint}>
          Від стартових значень рахуються баланс і бали цього акаунта — так само, як у твоїй
          Excel-таблиці.
        </Text>

        <Btn title="Зберегти" onPress={save} style={{ marginTop: spacing.l }} />
        {existing && accounts.length > 1 ? (
          <Btn
            title="Видалити акаунт"
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
  hint: { color: colors.faint, fontSize: 12, marginTop: spacing.s, lineHeight: 17 },
  balanceBox: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.l,
    padding: spacing.m,
    marginBottom: spacing.m,
  },
  boxHint: { color: colors.faint, fontSize: 12, lineHeight: 17, marginTop: -spacing.xs },
  corrections: {
    marginTop: spacing.m,
    paddingTop: spacing.s,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  correctionsTitle: { color: colors.sub, fontSize: 13, marginBottom: spacing.xs },
  correctionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  correctionDate: { color: colors.text, fontSize: 14, flex: 1 },
  correctionAmount: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  correctionDel: { marginLeft: spacing.m, paddingHorizontal: 6 },
  correctionDelText: { color: colors.faint, fontSize: 15, fontWeight: '700' },
});
