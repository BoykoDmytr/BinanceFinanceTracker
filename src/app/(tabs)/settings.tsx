import { router } from 'expo-router';
import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Screen } from '../../components/screen';
import { Btn, Card, SectionTitle } from '../../components/ui';
import { useData } from '../../lib/data-context';
import { pickCsvEntries, shareCsv } from '../../lib/export';
import { dateHuman, money, num } from '../../lib/format';
import { colors, radius, spacing } from '../../lib/theme';

export default function SettingsScreen() {
  const { overview, activeAccount, setActiveAccount, entries, importEntries } = useData();

  const exportCsv = async () => {
    try {
      await shareCsv(entries, activeAccount.name);
    } catch {
      Alert.alert('Не вдалося поділитись', 'Спробуй ще раз.');
    }
  };

  const importCsv = async () => {
    try {
      const parsed = await pickCsvEntries();
      if (!parsed) return;
      const sorted = [...parsed].sort((a, b) => (a.date < b.date ? -1 : 1));
      const first = sorted[0].date;
      const last = sorted[sorted.length - 1].date;
      Alert.alert(
        `Імпорт у «${activeAccount.name}»`,
        `Знайдено ${parsed.length} записів (${dateHuman(first, true)} — ${dateHuman(last, true)}).\n\nЇх буде додано в журнал акаунта «${activeAccount.name}». Записи з тими самими датами буде перезаписано, решта днів залишаться як є.`,
        [
          { text: 'Скасувати', style: 'cancel' },
          {
            text: 'Імпортувати',
            onPress: () => {
              importEntries(parsed);
              Alert.alert('Готово', `Імпортовано ${parsed.length} записів.`);
            },
          },
        ]
      );
    } catch (e) {
      Alert.alert('Не вдалося імпортувати', e instanceof Error ? e.message : 'Невідома помилка.');
    }
  };

  return (
    <Screen title="Налаштування">
      <SectionTitle>Акаунти</SectionTitle>
      <Card>
        {overview.map(({ account, stats }, i) => {
          const on = account.id === activeAccount.id;
          return (
            <View
              key={account.id}
              style={[styles.accRow, i < overview.length - 1 && styles.accRowBorder]}
            >
              <TouchableOpacity
                style={styles.accMain}
                onPress={() => setActiveAccount(account.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.radio, on && styles.radioOn]}>
                  {on ? <View style={styles.radioDot} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.accName, on && { color: colors.gold }]} numberOfLines={1}>
                    {account.name}
                  </Text>
                  <Text style={styles.accSub}>
                    {money(stats.balance)} · {num(stats.points)} балів
                    {account.spinReminder ? '' : ' · 🔕'}
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => router.push(`/account/${account.id}`)}
                hitSlop={8}
              >
                <Text style={styles.editText}>✎</Text>
              </TouchableOpacity>
            </View>
          );
        })}
        <Btn
          title="+ Додати акаунт"
          onPress={() => router.push('/account/new')}
          tone="ghost"
          style={{ marginTop: spacing.m }}
        />
        <Text style={styles.hint}>
          Тап по акаунту робить його активним: дашборд, журнал і експорт працюють з ним. ✎ —
          змінити назву, стартовий баланс і бали. Щоденне нагадування перевіряє всі акаунти.
        </Text>
      </Card>

      <SectionTitle>Дані — {activeAccount.name}</SectionTitle>
      <Card>
        <Btn title="Експортувати журнал у CSV" onPress={exportCsv} tone="ghost" />
        <View style={{ height: 10 }} />
        <Btn title="Імпортувати журнал з CSV" onPress={importCsv} tone="ghost" />
        <Text style={styles.hint}>
          Експорт — твій бекап: файл відкривається в Excel чи Google Таблицях. Експорт та
          імпорт працюють з активним акаунтом — для кожного акаунта окремий файл. Якщо
          перевстановиш застосунок — створи акаунти й імпортуй кожен файл у свій акаунт. Всі
          дані зберігаються лише локально на цьому телефоні.
        </Text>
      </Card>

      <SectionTitle>Про застосунок</SectionTitle>
      <Card>
        <Text style={styles.about}>CryptoFinance Tracker</Text>
        <Text style={styles.hint}>
          Трекер прокрутів Binance Alpha: журнал, P&L, бали, нагадування і заготовки постів.
          Історію з 01.07.2026 перенесено з Excel-таблиці.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.faint, fontSize: 12, marginTop: 10, lineHeight: 17 },
  about: { color: colors.gold, fontSize: 16, fontWeight: '800' },
  accRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  accRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  accMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.m },
  accName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  accSub: { color: colors.sub, fontSize: 12, marginTop: 2, fontVariant: ['tabular-nums'] },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.faint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.gold },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gold },
  editBtn: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.s,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: spacing.s,
  },
  editText: { color: colors.gold, fontSize: 16, fontWeight: '700' },
});
