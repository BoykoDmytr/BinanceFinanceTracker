import React, { useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { isActive } from '../lib/calc';
import { addDays, parseDate, todayISO } from '../lib/format';
import { colors } from '../lib/theme';
import type { Entry } from '../lib/types';

const CELL = 16;
const GAP = 3;
const MONTHS_UK_SHORT = [
  'січ', 'лют', 'бер', 'кві', 'тра', 'чер',
  'лип', 'сер', 'вер', 'жов', 'лис', 'гру',
];

type DayState = 'active' | 'drop' | 'missed' | 'none';

function stateColor(s: DayState): string {
  switch (s) {
    case 'active':
      return colors.green;
    case 'drop':
      return colors.gold;
    case 'missed':
      return colors.redDim;
    default:
      return colors.cardAlt;
  }
}

/** Теплова карта активності в стилі GitHub: колонка = тиждень (Пн зверху). */
export function Heatmap({ entries }: { entries: Entry[] }) {
  const { weeks, monthLabels } = useMemo(() => {
    const byDate = new Map(entries.map((e) => [e.date, e]));
    const today = todayISO();
    const first = entries.length ? entries.reduce((a, e) => (e.date < a ? e.date : a), today) : today;

    // відмотуємо до понеділка
    let start = first;
    while (parseDate(start).getDay() !== 1) start = addDays(start, -1);

    const weeks: { date: string; state: DayState }[][] = [];
    const monthLabels: { index: number; label: string }[] = [];
    let cursor = start;
    let lastMonth = -1;
    while (cursor <= today) {
      const week: { date: string; state: DayState }[] = [];
      for (let i = 0; i < 7; i++) {
        const e = byDate.get(cursor);
        let state: DayState = 'none';
        if (cursor <= today && cursor >= first) {
          if (e && e.dropIncome > 0) state = 'drop';
          else if (e && isActive(e)) state = 'active';
          else state = 'missed';
        }
        week.push({ date: cursor, state });
        cursor = addDays(cursor, 1);
      }
      const d0 = parseDate(week[0].date);
      const m = d0.getMonth();
      if (m !== lastMonth) {
        // на початку року (та на першій колонці) додаємо рік, щоб при
        // прокручуванні кількох років було видно, де який
        const withYear = m === 0 || weeks.length === 0;
        monthLabels.push({
          index: weeks.length,
          label: withYear ? `${MONTHS_UK_SHORT[m]} ’${String(d0.getFullYear()).slice(2)}` : MONTHS_UK_SHORT[m],
        });
        lastMonth = m;
      }
      weeks.push(week);
    }
    return { weeks, monthLabels };
  }, [entries]);

  const scrollRef = useRef<ScrollView>(null);

  return (
    <View>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator
        contentContainerStyle={{ paddingVertical: 4, paddingBottom: 10 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        <View>
          <View style={{ flexDirection: 'row', height: 16 }}>
            {weeks.map((_, i) => {
              const label = monthLabels.find((ml) => ml.index === i);
              return (
                <View key={i} style={{ width: CELL + GAP }}>
                  {label ? (
                    <Text numberOfLines={1} style={[styles.monthLabel, { width: 52 }]}>
                      {label.label}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row' }}>
            {weeks.map((week, wi) => (
              <View key={wi} style={{ marginRight: GAP }}>
                {week.map((day) => (
                  <View
                    key={day.date}
                    style={[styles.cell, { backgroundColor: stateColor(day.state) }]}
                  />
                ))}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
      <View style={styles.legend}>
        <LegendItem color={colors.green} label="крутив" />
        <LegendItem color={colors.gold} label="дроп" />
        <LegendItem color={colors.redDim} label="пропустив" />
      </View>
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    width: CELL,
    height: CELL,
    borderRadius: 4,
    marginBottom: GAP,
  },
  monthLabel: { color: colors.sub, fontSize: 10 },
  legend: { flexDirection: 'row', gap: 14, marginTop: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendText: { color: colors.sub, fontSize: 12 },
});
