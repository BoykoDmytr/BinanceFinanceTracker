import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { BarChart, LineChart } from '../../components/charts';
import { Heatmap } from '../../components/heatmap';
import { Screen } from '../../components/screen';
import { StatCard } from '../../components/stat-card';
import { Card, SectionTitle } from '../../components/ui';
import { forecastPoints } from '../../lib/calc';
import { useData } from '../../lib/data-context';
import {
  dateHuman,
  dateHumanWD,
  daysWord,
  money,
  moneySigned,
  num,
  pct,
  todayISO,
} from '../../lib/format';
import { colors, spacing } from '../../lib/theme';

export default function Dashboard() {
  const { stats, settings, entries } = useData();
  const today = todayISO();

  const balanceSeries = stats.series.map((p) => ({ date: p.date, value: p.balance }));
  const pointsSeries = stats.series.map((p) => ({ date: p.date, value: p.points }));
  const volumeSeries = stats.series.slice(-30).map((p) => ({ date: p.date, value: p.volume }));

  return (
    <Screen title="CRYPTO HORNET" subtitle={dateHumanWD(today)}>
      {/* Статус дня */}
      {stats.todayLogged ? (
        <View style={[styles.banner, { backgroundColor: colors.greenDim, borderColor: colors.green }]}>
          <Text style={[styles.bannerTitle, { color: colors.green }]}>
            ✓ Сьогодні прокручено
          </Text>
          <Text style={styles.bannerSub}>
            🔥 Стрік: {stats.streak} {daysWord(stats.streak)} підряд
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.banner, { backgroundColor: colors.redDim, borderColor: colors.red }]}
          onPress={() => router.push(`/entry/${today}`)}
          activeOpacity={0.8}
        >
          <Text style={[styles.bannerTitle, { color: colors.red }]}>
            Сьогодні ще немає прокруту!
          </Text>
          <Text style={styles.bannerSub}>
            {stats.streak > 0
              ? `Стрік ${stats.streak} ${daysWord(stats.streak)} під загрозою — тисни, щоб записати день`
              : 'Тисни, щоб записати день'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Головні цифри */}
      <View style={styles.grid}>
        <StatCard label="Баланс" value={money(stats.balance)} tone="blue" />
        <StatCard label="Бали" value={num(stats.points)} tone="gold" />
        <StatCard
          label="P&L операції"
          value={moneySigned(stats.pnl)}
          tone={stats.pnl >= 0 ? 'green' : 'red'}
          sub="дропи − комісії − газ"
        />
        <StatCard
          label="ROI"
          value={pct(stats.roi)}
          tone={stats.roi >= 0 ? 'green' : 'red'}
          sub="на вкладені витрати"
        />
      </View>

      <SectionTitle>Активність</SectionTitle>
      <Card>
        <Heatmap entries={entries} />
      </Card>

      <SectionTitle>Графіки</SectionTitle>
      <Card>
        <Text style={styles.chartTitle}>Баланс, $</Text>
        <LineChart data={balanceSeries} color={colors.gold} formatValue={(v) => money(v)} />
      </Card>
      <Card>
        <Text style={styles.chartTitle}>Бали (залишок)</Text>
        <LineChart data={pointsSeries} color={colors.blue} formatValue={(v) => num(v)} />
      </Card>
      <Card>
        <Text style={styles.chartTitle}>Обсяг торгівлі (останні 30 днів), $</Text>
        <BarChart data={volumeSeries} color={colors.green} formatValue={(v) => money(v, 0)} />
      </Card>

      <SectionTitle>Прогноз балів</SectionTitle>
      <Card>
        <RowStat label="Через 7 днів" value={num(forecastPoints(stats, settings, 7))} accent />
        <RowStat label="Через 14 днів" value={num(forecastPoints(stats, settings, 14))} accent />
        <RowStat label="Через 30 днів" value={num(forecastPoints(stats, settings, 30))} accent />
        <Text style={styles.hint}>
          За темпу {num(settings.defaultPoints)} балів/день без витрат на дропи
        </Text>
      </Card>

      <SectionTitle>Статистика</SectionTitle>
      <Card>
        <RowStat label="Загальний обсяг торгівлі" value={money(stats.totalVolume, 0)} />
        <RowStat label="Загальні комісії" value={money(stats.totalFees)} negative />
        <RowStat label="Витрати на дропи (газ/фі)" value={money(stats.totalGas)} negative />
        <RowStat label="Дохід з дропів" value={money(stats.totalDrop)} positive />
        <RowStat label="Активних днів" value={String(stats.activeDays)} />
        <RowStat label="Балів зароблено" value={num(stats.pointsEarned)} />
        <RowStat label="Балів витрачено" value={num(stats.pointsSpent)} />
        <RowStat label="Середні бали / день" value={num(stats.avgPointsPerDay, 1)} />
        <RowStat label="Собівартість 1 бала" value={money(stats.costPerPoint, 3)} />
      </Card>

      <SectionTitle>Дропи</SectionTitle>
      {stats.drops.length === 0 ? (
        <Card>
          <Text style={styles.hint}>Поки що жодного дропу не записано.</Text>
        </Card>
      ) : (
        <Card>
          {stats.drops.map((d, i) => (
            <View
              key={d.date}
              style={[styles.dropRow, i < stats.drops.length - 1 && styles.dropRowBorder]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.dropDate}>{dateHuman(d.date, true)}</Text>
                {d.comment ? (
                  <Text style={styles.dropComment} numberOfLines={1}>
                    {d.comment}
                  </Text>
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.dropIncome}>{moneySigned(d.income)}</Text>
                {d.pointsSpent > 0 ? (
                  <Text style={styles.dropPoints}>−{num(d.pointsSpent)} балів</Text>
                ) : null}
              </View>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

function RowStat({
  label,
  value,
  positive,
  negative,
  accent,
}: {
  label: string;
  value: string;
  positive?: boolean;
  negative?: boolean;
  accent?: boolean;
}) {
  const color = positive ? colors.green : negative ? colors.red : accent ? colors.gold : colors.text;
  return (
    <View style={styles.rowStat}>
      <Text style={styles.rowStatLabel}>{label}</Text>
      <Text style={[styles.rowStatValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: 14,
    borderWidth: 1,
    padding: spacing.l,
    marginBottom: spacing.m,
  },
  bannerTitle: { fontSize: 16, fontWeight: '800' },
  bannerSub: { color: colors.sub, fontSize: 13, marginTop: 4 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.m,
    marginBottom: spacing.xs,
  },
  chartTitle: { color: colors.sub, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  rowStat: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
  },
  rowStatLabel: { color: colors.sub, fontSize: 14, flex: 1, paddingRight: 8 },
  rowStatValue: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  hint: { color: colors.faint, fontSize: 12, marginTop: 6 },
  dropRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  dropRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  dropDate: { color: colors.text, fontSize: 14, fontWeight: '600' },
  dropComment: { color: colors.faint, fontSize: 12, marginTop: 2 },
  dropIncome: { color: colors.gold, fontSize: 15, fontWeight: '800' },
  dropPoints: { color: colors.sub, fontSize: 12, marginTop: 2 },
});
