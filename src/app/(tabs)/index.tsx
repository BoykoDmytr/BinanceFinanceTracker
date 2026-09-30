import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { BarChart, LineChart } from '../../components/charts';
import { Heatmap } from '../../components/heatmap';
import { MonthlyResults } from '../../components/monthly-results';
import { Screen } from '../../components/screen';
import { StatCard } from '../../components/stat-card';
import { Card, SectionTitle } from '../../components/ui';
import { forecastPoints, monthlyResults } from '../../lib/calc';
import { useData, type AccountOverview } from '../../lib/data-context';
import {
  dateHuman,
  dateHumanWD,
  daysWord,
  isZeroMoney,
  money,
  moneySigned,
  num,
  pct,
} from '../../lib/format';
import { colors, spacing } from '../../lib/theme';

export default function Dashboard() {
  const { stats, activeAccount, overview, setActiveAccount, entries, adjustments, today } =
    useData();
  const multi = overview.length > 1;
  const months = useMemo(
    () => monthlyResults(entries, activeAccount, today, adjustments),
    [entries, activeAccount, today, adjustments]
  );

  const balanceSeries = stats.series.map((p) => ({ date: p.date, value: p.balance }));
  const pointsSeries = stats.series.map((p) => ({ date: p.date, value: p.points }));
  const volumeSeries = stats.series.slice(-30).map((p) => ({ date: p.date, value: p.volume }));

  return (
    <Screen title="CryptoFinance Tracker" subtitle={dateHumanWD(today)}>
      {multi ? (
        <>
          <SectionTitle>Усі акаунти</SectionTitle>
          <AccountsOverview
            items={overview}
            activeId={activeAccount.id}
            onSelect={setActiveAccount}
          />
          <SectionTitle>{activeAccount.name}</SectionTitle>
        </>
      ) : null}

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
        <StatCard
          label="Баланс"
          value={money(stats.balance)}
          tone="blue"
          sub={
            isZeroMoney(stats.totalAdjustments)
              ? undefined
              : `з корекціями ${moneySigned(stats.totalAdjustments)}`
          }
        />
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

      <SectionTitle>Результати по місяцях</SectionTitle>
      <MonthlyResults key={activeAccount.id} months={months} today={today} />

      <SectionTitle>Графіки</SectionTitle>
      <Card>
        <Text style={styles.chartTitle}>Баланс, $</Text>
        <LineChart
          data={balanceSeries}
          color={colors.gold}
          formatValue={(v) => money(v)}
          formatAxis={(v) => money(v, 0)}
        />
      </Card>
      <Card>
        <Text style={styles.chartTitle}>Бали (залишок)</Text>
        <LineChart
          data={pointsSeries}
          color={colors.blue}
          formatValue={(v) => num(v)}
          formatAxis={(v) => num(v)}
        />
      </Card>
      <Card>
        <Text style={styles.chartTitle}>Обсяг торгівлі (останні 30 днів), $</Text>
        <BarChart
          data={volumeSeries}
          color={colors.green}
          formatValue={(v) => money(v, 0)}
          formatAxis={(v) => money(v, 0)}
        />
      </Card>

      <SectionTitle>Прогноз балів</SectionTitle>
      <Card>
        <RowStat label="Через 7 днів" value={num(forecastPoints(stats, activeAccount, 7))} accent />
        <RowStat label="Через 14 днів" value={num(forecastPoints(stats, activeAccount, 14))} accent />
        <RowStat label="Через 30 днів" value={num(forecastPoints(stats, activeAccount, 30))} accent />
        <Text style={styles.hint}>
          За темпу {num(activeAccount.defaultPoints)} балів/день без витрат на дропи
        </Text>
      </Card>

      <SectionTitle>Статистика</SectionTitle>
      <Card>
        <RowStat label="Загальний обсяг торгівлі" value={money(stats.totalVolume, 0)} />
        <RowStat label="Загальні комісії" value={money(stats.totalFees)} negative />
        <RowStat label="Витрати на дропи (газ/фі)" value={money(stats.totalGas)} negative />
        <RowStat label="Дохід з дропів" value={money(stats.totalDrop)} positive />
        <RowStat label="Дохід з бустерів" value={money(stats.totalBooster)} positive />
        {!isZeroMoney(stats.totalAdjustments) ? (
          <RowStat label="Корекції балансу (не в P&L)" value={moneySigned(stats.totalAdjustments)} />
        ) : null}
        <RowStat label="Активних днів" value={String(stats.activeDays)} />
        <RowStat label="Балів зароблено" value={num(stats.pointsEarned)} />
        <RowStat label="Балів витрачено" value={num(stats.pointsSpent)} />
        <RowStat label="Середні бали / день" value={num(stats.avgPointsPerDay, 1)} />
        <RowStat label="Собівартість 1 бала" value={money(stats.costPerPoint, 3)} />
      </Card>

      <SectionTitle>Дропи</SectionTitle>
      <IncomeList
        items={stats.drops}
        emptyText="Поки що жодного дропу не записано."
        showPoints
      />

      <SectionTitle>Бустери</SectionTitle>
      <IncomeList
        items={stats.boosters}
        emptyText={'Поки що жодного доходу з бустерів.\nВписуй його в журналі — графа «Дохід з бустерів».'}
      />
    </Screen>
  );
}

/**
 * Моніторинг усіх акаунтів одразу: чи прокручено сьогодні, баланс, бали, P&L.
 * Тап по рядку робить акаунт активним — нижче на дашборді з'являються його деталі.
 * Бали не підсумовуються: вони в кожного акаунта свої і між акаунтами не складаються.
 */
function AccountsOverview({
  items,
  activeId,
  onSelect,
}: {
  items: AccountOverview[];
  activeId: number;
  onSelect: (id: number) => void;
}) {
  const logged = items.filter((o) => o.stats.todayLogged).length;
  const totalBalance = items.reduce((a, o) => a + o.stats.balance, 0);
  const totalPnl = items.reduce((a, o) => a + o.stats.pnl, 0);
  return (
    <Card>
      {items.map(({ account, stats }, i) => {
        const on = account.id === activeId;
        return (
          <TouchableOpacity
            key={account.id}
            style={[styles.accRow, i < items.length - 1 && styles.dropRowBorder]}
            onPress={() => onSelect(account.id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.accStatus, { color: stats.todayLogged ? colors.green : colors.red }]}>
              {stats.todayLogged ? '✓' : '✗'}
            </Text>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={[styles.accName, on && { color: colors.gold }]} numberOfLines={1}>
                {account.name}
              </Text>
              <Text style={styles.accSub}>
                {num(stats.points)} балів
                {stats.streak > 0 ? ` · 🔥 ${stats.streak} ${daysWord(stats.streak)}` : ''}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.accBalance}>{money(stats.balance)}</Text>
              <Text style={[styles.accPnl, { color: stats.pnl >= 0 ? colors.green : colors.red }]}>
                {moneySigned(stats.pnl)}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
      <View style={styles.accTotal}>
        <Text style={styles.accTotalLabel}>
          Прокручено сьогодні: {logged} з {items.length}
        </Text>
        <Text style={styles.accTotalLabel}>
          Разом: <Text style={styles.accTotalValue}>{money(totalBalance)}</Text>
          {'  '}
          <Text style={{ color: totalPnl >= 0 ? colors.green : colors.red, fontWeight: '700' }}>
            {moneySigned(totalPnl)}
          </Text>
        </Text>
      </View>
    </Card>
  );
}

function IncomeList({
  items,
  emptyText,
  showPoints,
}: {
  items: { date: string; income: number; pointsSpent: number; comment: string }[];
  emptyText: string;
  showPoints?: boolean;
}) {
  if (items.length === 0) {
    return (
      <Card>
        <Text style={styles.hint}>{emptyText}</Text>
      </Card>
    );
  }
  return (
    <Card>
      {items.map((d, i) => (
        <View key={d.date} style={[styles.dropRow, i < items.length - 1 && styles.dropRowBorder]}>
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
            {showPoints && d.pointsSpent > 0 ? (
              <Text style={styles.dropPoints}>−{num(d.pointsSpent)} балів</Text>
            ) : null}
          </View>
        </View>
      ))}
    </Card>
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
  accRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  accStatus: { fontSize: 16, fontWeight: '800', width: 24 },
  accName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  accSub: { color: colors.sub, fontSize: 12, marginTop: 2 },
  accBalance: { color: colors.text, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  accPnl: { fontSize: 12, fontWeight: '700', marginTop: 2, fontVariant: ['tabular-nums'] },
  accTotal: {
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 4,
  },
  accTotalLabel: { color: colors.sub, fontSize: 13 },
  accTotalValue: { color: colors.text, fontWeight: '700' },
});
