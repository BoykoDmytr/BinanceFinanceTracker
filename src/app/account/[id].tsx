import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';

import { Btn, Field, ToggleRow } from '../../components/ui';
import { useData } from '../../lib/data-context';
import { colors, spacing } from '../../lib/theme';

function parseNum(s: string): number | null {
  const n = Number(s.replace(',', '.').replace(/\s/g, ''));
  return s.trim() !== '' && Number.isFinite(n) ? n : null;
}

export default function AccountEditor() {
  const params = useLocalSearchParams<{ id: string }>();
  const isNew = params.id === 'new';
  const {
    accounts,
    activeAccount,
    entriesByAccount,
    addAccount,
    editAccount,
    removeAccount,
    setActiveAccount,
  } = useData();

  const existing = isNew ? null : (accounts.find((a) => a.id === Number(params.id)) ?? null);

  const [name, setName] = useState(existing?.name ?? '');
  const [startBalance, setStartBalance] = useState(String(existing?.startBalance ?? 0));
  const [startPoints, setStartPoints] = useState(String(existing?.startPoints ?? 0));
  // для нового акаунта темп балів беремо з поточного — зазвичай він однаковий
  const [defaultPoints, setDefaultPoints] = useState(
    String(existing?.defaultPoints ?? activeAccount.defaultPoints)
  );
  const [spinReminder, setSpinReminder] = useState(existing?.spinReminder ?? true);

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
    if (sb === null || sp === null || dp === null) {
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
    } else {
      // щойно створений акаунт одразу стає активним — його журнал і заповнюватимуть
      setActiveAccount(addAccount(data).id);
    }
    router.back();
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
});
