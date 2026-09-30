import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { MonthResult } from '../lib/calc';
import { isZeroMoney, money, moneySigned, monthHuman, num, pct } from '../lib/format';
import { colors, spacing } from '../lib/theme';
import { Card, Chip } from './ui';

/**
 * Результати по місяцях, від найновішого: рядок — місяць з P&L, тап розгортає
 * деталі. Найновіший місяць розгорнутий одразу.
 */
export function MonthlyResults({ months, today }: { months: MonthResult[]; today: string }) {
  const [open, setOpen] = useState<string | null>(months[0]?.month ?? null);
  const current = today.slice(0, 7);

  if (months.length === 0) {
    return (
      <Card>
        <Text style={styles.empty}>Поки що жодного запису в журналі.</Text>
      </Card>
    );
  }

  return (
    <Card>
      {months.map((m, i) => {
        const isOpen = open === m.month;
        return (
          <TouchableOpacity
            key={m.month}
            style={[styles.month, i < months.length - 1 && styles.monthBorder]}
            onPress={() => setOpen(isOpen ? null : m.month)}
            activeOpacity={0.7}
          >
            <View style={styles.head}>
              <View style={{ flex: 1, paddingRight: spacing.s }}>
                <View style={styles.titleRow}>
                  <Text style={styles.title}>
                    {isOpen ? '▾' : '▸'} {monthHuman(m.month)}
                  </Text>
                  {m.month === current ? (
                    <Chip text="триває" color={colors.gold} bg={colors.goldDim + '33'} />
                  ) : null}
                </View>
                <Text style={styles.sub}>
                  Активних {m.activeDays} з {m.days} · бали +{num(m.pointsEarned)} / −
                  {num(m.pointsSpent)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.pnl, { color: m.pnl >= 0 ? colors.green : colors.red }]}>
                  {moneySigned(m.pnl)}
                </Text>
                <Text style={styles.sub}>P&L</Text>
              </View>
            </View>

            {isOpen ? (
              <View style={styles.details}>
                <Line label="Обсяг торгівлі" value={money(m.volume, 0)} />
                <Line label="Комісії" value={money(m.fees)} color={colors.red} />
                <Line label="Газ / фі" value={money(m.gas)} color={colors.red} />
                <Line label="Дохід з дропів" value={money(m.drop)} color={colors.gold} />
                <Line label="Дохід з бустерів" value={money(m.booster)} color={colors.gold} />
                <Line
                  label="ROI"
                  value={pct(m.roi)}
                  color={m.roi >= 0 ? colors.green : colors.red}
                />
                {!isZeroMoney(m.adjustments) ? (
                  <Line label="Корекції балансу" value={moneySigned(m.adjustments)} />
                ) : null}
                <Line
                  label="Баланс"
                  value={`${money(m.balanceStart)} → ${money(m.balanceEnd)}`}
                />
                <Line label="Бали (залишок)" value={num(m.pointsEnd)} color={colors.blue} />
              </View>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </Card>
  );
}

function Line({ label, value, color = colors.text }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={[styles.lineValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { color: colors.faint, fontSize: 12 },
  month: { paddingVertical: 10 },
  monthBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  head: { flexDirection: 'row', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  title: { color: colors.text, fontSize: 15, fontWeight: '700' },
  sub: { color: colors.sub, fontSize: 12, marginTop: 2, fontVariant: ['tabular-nums'] },
  pnl: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  details: {
    marginTop: spacing.s,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  lineLabel: { color: colors.sub, fontSize: 13, flex: 1, paddingRight: spacing.s },
  lineValue: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
