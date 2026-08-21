import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Screen } from '../../components/screen';
import { Chip } from '../../components/ui';
import { isActive, periodSummary, sortByDate } from '../../lib/calc';
import { useData } from '../../lib/data-context';
import { addDays, dateHumanWD, money, moneySigned, num } from '../../lib/format';
import { colors, radius, spacing } from '../../lib/theme';
import type { Entry } from '../../lib/types';

interface DayItem {
  date: string;
  entry: Entry | null;
  balanceAfter: number | null;
  pointsAfter: number | null;
}

export default function Journal() {
  const { entries, stats, today } = useData();
  const [showSummary, setShowSummary] = useState(false);
  const summary = useMemo(() => periodSummary(entries, 15, today), [entries, today]);

  const items = useMemo<DayItem[]>(() => {
    if (entries.length === 0) return [{ date: today, entry: null, balanceAfter: null, pointsAfter: null }];
    const sorted = sortByDate(entries);
    const first = sorted[0].date;
    const last = sorted[sorted.length - 1].date > today ? sorted[sorted.length - 1].date : today;
    const byDate = new Map(sorted.map((e) => [e.date, e]));
    const seriesByDate = new Map(stats.series.map((p) => [p.date, p]));

    const out: DayItem[] = [];
    let cursor = last;
    while (cursor >= first) {
      const e = byDate.get(cursor) ?? null;
      const s = seriesByDate.get(cursor);
      out.push({
        date: cursor,
        entry: e,
        balanceAfter: s ? s.balance : null,
        pointsAfter: s ? s.points : null,
      });
      cursor = addDays(cursor, -1);
    }
    return out;
  }, [entries, stats.series, today]);

  return (
    <Screen
      title="Журнал"
      subtitle={`${stats.activeDays} активних днів`}
      actionLabel="+ Сьогодні"
      onAction={() => router.push(`/entry/${today}`)}
      scroll={false}
    >
      <FlatList
        data={items}
        keyExtractor={(it) => it.date}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListHeaderComponent={
          <View style={styles.summaryWrap}>
            <TouchableOpacity
              style={styles.summaryToggle}
              onPress={() => setShowSummary((v) => !v)}
              activeOpacity={0.7}
            >
              <Text style={styles.summaryToggleText}>
                {showSummary ? '▾ Підсумок за 15 днів' : '▸ Підсумок за 15 днів'}
              </Text>
            </TouchableOpacity>
            {showSummary ? (
              <View style={styles.summaryCard}>
                <SummaryRow label="Активних днів" value={`${summary.activeDays} з ${summary.days}`} />
                <SummaryRow label="Обсяг торгівлі" value={money(summary.volume, 0)} />
                <SummaryRow label="Комісії" value={money(summary.fees)} tone={colors.red} />
                <SummaryRow label="Газ / фі" value={money(summary.gas)} tone={colors.red} />
                <SummaryRow label="Дохід з дропів" value={money(summary.drop)} tone={colors.gold} />
                <SummaryRow label="Дохід з бустерів" value={money(summary.booster)} tone={colors.gold} />
                <SummaryRow
                  label="Бали"
                  value={`+${num(summary.pointsEarned)} / −${num(summary.pointsSpent)}`}
                  tone={colors.blue}
                />
                <SummaryRow
                  label="P&L за період"
                  value={moneySigned(summary.pnl)}
                  tone={summary.pnl >= 0 ? colors.green : colors.red}
                  bold
                />
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => <DayRow item={item} isToday={item.date === today} />}
      />
    </Screen>
  );
}

function SummaryRow({
  label,
  value,
  tone = colors.text,
  bold,
}: {
  label: string;
  value: string;
  tone?: string;
  bold?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, { color: tone }, bold && { fontSize: 15 }]}>{value}</Text>
    </View>
  );
}

function DayRow({ item, isToday }: { item: DayItem; isToday: boolean }) {
  const e = item.entry;
  const active = e ? isActive(e) : false;
  const hasDrop = !!e && e.dropIncome > 0;

  return (
    <TouchableOpacity
      style={[
        styles.row,
        hasDrop && styles.rowDrop,
        !active && !isToday && styles.rowMissed,
      ]}
      onPress={() => router.push(`/entry/${item.date}`)}
      activeOpacity={0.7}
    >
      <View style={styles.rowHeader}>
        <Text style={styles.date}>{dateHumanWD(item.date)}</Text>
        {isToday && !active ? (
          <Chip text="сьогодні" color={colors.gold} bg={colors.goldDim + '33'} />
        ) : null}
        {hasDrop ? <Chip text="🪂 дроп" color={colors.gold} bg={colors.goldDim + '33'} /> : null}
        {!active && !isToday ? (
          <Chip text="пропущено" color={colors.red} bg={colors.redDim} />
        ) : null}
      </View>

      {e && active ? (
        <>
          <View style={styles.numbersRow}>
            <NumCol label="Обсяг" value={money(e.volume, 0)} />
            <NumCol label="Комісія" value={money(e.fee)} color={colors.red} />
            <NumCol
              label="Бали"
              value={`+${e.pointsPlus}${e.pointsMinus > 0 ? ` / −${e.pointsMinus}` : ''}`}
              color={colors.blue}
            />
            {e.dropIncome > 0 ? (
              <NumCol label="Дроп" value={`+${money(e.dropIncome)}`} color={colors.gold} />
            ) : null}
            {e.boosterIncome > 0 ? (
              <NumCol label="Бустер" value={`+${money(e.boosterIncome)}`} color={colors.gold} />
            ) : null}
            {e.gasExpense > 0 ? (
              <NumCol label="Газ" value={money(e.gasExpense)} color={colors.red} />
            ) : null}
          </View>
          <View style={styles.afterRow}>
            {item.balanceAfter !== null ? (
              <Text style={styles.after}>
                Баланс: <Text style={styles.afterValue}>{money(item.balanceAfter)}</Text>
              </Text>
            ) : null}
            {item.pointsAfter !== null ? (
              <Text style={styles.after}>
                Бали: <Text style={styles.afterValue}>{num(item.pointsAfter)}</Text>
              </Text>
            ) : null}
          </View>
          {e.comment ? (
            <Text style={styles.comment} numberOfLines={2}>
              {e.comment}
            </Text>
          ) : null}
        </>
      ) : (
        <Text style={styles.missedText}>
          {isToday ? 'Запису ще немає — тисни, щоб додати' : 'Немає запису за цей день'}
        </Text>
      )}
    </TouchableOpacity>
  );
}

function NumCol({ label, value, color = colors.text }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ marginRight: spacing.l }}>
      <Text style={styles.numLabel}>{label}</Text>
      <Text style={[styles.numValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.card,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.l,
    marginBottom: spacing.s,
  },
  rowDrop: { borderColor: colors.goldDim },
  rowMissed: { opacity: 0.75, borderColor: colors.redDim },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    marginBottom: 8,
  },
  date: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 },
  numbersRow: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 6 },
  numLabel: { color: colors.faint, fontSize: 10, marginBottom: 1 },
  numValue: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  afterRow: {
    flexDirection: 'row',
    gap: spacing.l,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  after: { color: colors.sub, fontSize: 12 },
  afterValue: { color: colors.text, fontWeight: '700' },
  comment: { color: colors.sub, fontSize: 12, marginTop: 6, fontStyle: 'italic' },
  missedText: { color: colors.faint, fontSize: 13 },
  summaryWrap: { marginBottom: spacing.s },
  summaryToggle: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.m,
    paddingVertical: 10,
    paddingHorizontal: spacing.l,
  },
  summaryToggleText: { color: colors.gold, fontWeight: '700', fontSize: 14 },
  summaryCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: radius.l,
    padding: spacing.l,
    marginTop: spacing.s,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  summaryLabel: { color: colors.sub, fontSize: 13 },
  summaryValue: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
