import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Screen } from '../../components/screen';
import { Btn, Card, Field, SectionTitle } from '../../components/ui';
import { useData } from '../../lib/data-context';
import { pickCsvEntries, shareCsv } from '../../lib/export';
import { dateHuman } from '../../lib/format';
import { colors } from '../../lib/theme';

function parseNum(s: string): number | null {
  const n = Number(s.replace(',', '.').replace(/\s/g, ''));
  return Number.isFinite(n) ? n : null;
}

export default function SettingsScreen() {
  const { settings, updateSettings, entries, importEntries } = useData();

  const [startBalance, setStartBalance] = useState(String(settings.startBalance));
  const [startPoints, setStartPoints] = useState(String(settings.startPoints));
  const [defaultPoints, setDefaultPoints] = useState(String(settings.defaultPoints));

  const save = () => {
    const sb = parseNum(startBalance);
    const sp = parseNum(startPoints);
    const dp = parseNum(defaultPoints);
    if (sb === null || sp === null || dp === null) {
      Alert.alert('Помилка', 'Перевір числа — щось не вдалося прочитати.');
      return;
    }
    updateSettings({
      ...settings,
      startBalance: sb,
      startPoints: Math.round(sp),
      defaultPoints: Math.round(dp),
    });
    Alert.alert('Збережено', 'Баланс і бали перераховано з нових стартових значень.');
  };

  const exportCsv = async () => {
    try {
      await shareCsv(entries);
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
        'Імпорт журналу',
        `Знайдено ${parsed.length} записів (${dateHuman(first, true)} — ${dateHuman(last, true)}).\n\nЗаписи з тими самими датами буде перезаписано, решта днів залишаться як є.`,
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
      <SectionTitle>Стартові значення</SectionTitle>
      <Card>
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
        <Btn title="Зберегти" onPress={save} />
        <Text style={styles.hint}>
          Від цих значень рахуються баланс і бали — так само, як у твоїй Excel-таблиці.
        </Text>
      </Card>

      <SectionTitle>Дані</SectionTitle>
      <Card>
        <Btn title="Експортувати журнал у CSV" onPress={exportCsv} tone="ghost" />
        <View style={{ height: 10 }} />
        <Btn title="Імпортувати журнал з CSV" onPress={importCsv} tone="ghost" />
        <Text style={styles.hint}>
          Експорт — твій бекап: файл відкривається в Excel чи Google Таблицях. Якщо
          перевстановиш застосунок — просто імпортуй цей файл назад, і журнал відновиться.
          Всі дані зберігаються лише локально на цьому телефоні.
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
});
