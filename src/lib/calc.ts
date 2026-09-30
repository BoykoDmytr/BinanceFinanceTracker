import { addDays, parseDate, todayISO } from './format';
import type { AccountParams, BalanceAdjustment, EntriesByAccount, Entry } from './types';

export interface DayPoint {
  date: string;
  balance: number;
  points: number;
  volume: number;
}

export interface IncomeDay {
  date: string;
  income: number;
  pointsSpent: number;
  comment: string;
}

export interface Stats {
  balance: number;
  points: number;
  pnl: number;
  roi: number;
  totalVolume: number;
  totalFees: number;
  totalGas: number;
  totalDrop: number;
  totalBooster: number;
  /** сума корекцій балансу (у P&L не входить) */
  totalAdjustments: number;
  activeDays: number;
  pointsEarned: number;
  pointsSpent: number;
  avgPointsPerDay: number;
  costPerPoint: number;
  streak: number;
  todayLogged: boolean;
  series: DayPoint[];
  drops: IncomeDay[];
  boosters: IncomeDay[];
}

export function sortByDate(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** День вважається «прокрученим», якщо в ньому є фактична активність. */
export function isActive(e: Entry): boolean {
  return e.volume > 0 || e.fee > 0 || e.dropIncome > 0 || e.boosterIncome > 0;
}

/** День хронології: запис журналу (якщо є) і корекція балансу за цю дату. */
interface JournalDay {
  date: string;
  entry: Entry | null;
  adjustment: number;
}

/** Зводить записи й корекції в одну хронологію — по одному дню на дату. */
function journalDays(entries: Entry[], adjustments: BalanceAdjustment[]): JournalDay[] {
  const byDate = new Map<string, JournalDay>();
  for (const e of entries) byDate.set(e.date, { date: e.date, entry: e, adjustment: 0 });
  for (const a of adjustments) {
    const day = byDate.get(a.date);
    if (day) day.adjustment += a.amount;
    else byDate.set(a.date, { date: a.date, entry: null, adjustment: a.amount });
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Зміна балансу від операцій дня (без корекції). */
function entryBalanceDelta(e: Entry): number {
  return e.dropIncome + e.boosterIncome - e.fee - e.gasExpense;
}

/**
 * Та сама математика, що й у Excel-таблиці (плюс окрема графа бустерів і
 * корекції балансу):
 *  Баланс = старт − Σкомісій − Σгазу + Σдропів + Σбустерів + Σкорекцій
 *  Бали   = старт + Σ(бали+) − Σ(бали−)
 *  P&L    = Σдропів + Σбустерів − Σкомісій − Σгазу   (корекції не входять)
 *  ROI    = P&L / (Σкомісій + Σгазу)
 */
export function computeStats(
  entries: Entry[],
  s: AccountParams,
  today = todayISO(),
  adjustments: BalanceAdjustment[] = []
): Stats {
  const sorted = sortByDate(entries);

  let balance = s.startBalance;
  let points = s.startPoints;
  let totalVolume = 0;
  let totalFees = 0;
  let totalGas = 0;
  let totalDrop = 0;
  let totalBooster = 0;
  let totalAdjustments = 0;
  let pointsEarned = 0;
  let pointsSpent = 0;
  let activeDays = 0;

  const series: DayPoint[] = [];
  const drops: IncomeDay[] = [];
  const boosters: IncomeDay[] = [];

  for (const { date, entry: e, adjustment } of journalDays(sorted, adjustments)) {
    balance += adjustment;
    totalAdjustments += adjustment;
    if (e) {
      balance += entryBalanceDelta(e);
      points += e.pointsPlus - e.pointsMinus;
      totalVolume += e.volume;
      totalFees += e.fee;
      totalGas += e.gasExpense;
      totalDrop += e.dropIncome;
      totalBooster += e.boosterIncome;
      pointsEarned += e.pointsPlus;
      pointsSpent += e.pointsMinus;
      if (isActive(e)) activeDays += 1;
      if (e.dropIncome > 0) {
        drops.push({ date, income: e.dropIncome, pointsSpent: e.pointsMinus, comment: e.comment });
      }
      if (e.boosterIncome > 0) {
        boosters.push({ date, income: e.boosterIncome, pointsSpent: e.pointsMinus, comment: e.comment });
      }
    }
    series.push({ date, balance, points, volume: e ? e.volume : 0 });
  }

  const pnl = totalDrop + totalBooster - totalFees - totalGas;
  const costs = totalFees + totalGas;

  const byDate = new Map(sorted.map((e) => [e.date, e]));
  const todayEntry = byDate.get(today);
  const todayLogged = !!todayEntry && isActive(todayEntry);

  // Стрік: скільки днів підряд була активність, рахуючи від сьогодні
  // (якщо сьогодні ще не записано — від учора, стрік ще не втрачено).
  let streak = 0;
  let cursor = todayLogged ? today : addDays(today, -1);
  while (true) {
    const e = byDate.get(cursor);
    if (e && isActive(e)) {
      streak += 1;
      cursor = addDays(cursor, -1);
    } else {
      break;
    }
  }

  return {
    balance,
    points,
    pnl,
    roi: costs === 0 ? 0 : pnl / costs,
    totalVolume,
    totalFees,
    totalGas,
    totalDrop,
    totalBooster,
    totalAdjustments,
    activeDays,
    pointsEarned,
    pointsSpent,
    avgPointsPerDay: activeDays === 0 ? 0 : pointsEarned / activeDays,
    costPerPoint: pointsEarned === 0 ? 0 : totalFees / pointsEarned,
    streak,
    todayLogged,
    series,
    drops: drops.reverse(),
    boosters: boosters.reverse(),
  };
}

/**
 * Нова сума корекції за день, з якою баланс стане `target`. `current` — баланс
 * зараз, уже з наявною корекцією цього дня `dayAmount`, тож до неї додається
 * лише різниця. Округлення до центів прибирає «хвости» float-арифметики.
 */
export function correctionFor(current: number, target: number, dayAmount: number): number {
  return Math.round((dayAmount + target - current) * 100) / 100;
}

export interface PeriodSummary {
  days: number;
  activeDays: number;
  volume: number;
  fees: number;
  gas: number;
  drop: number;
  booster: number;
  pointsEarned: number;
  pointsSpent: number;
  pnl: number;
}

/** Стислий підсумок за останні `days` днів (включно з сьогодні). */
export function periodSummary(entries: Entry[], days: number, today = todayISO()): PeriodSummary {
  const from = addDays(today, -(days - 1));
  const sum: PeriodSummary = {
    days,
    activeDays: 0,
    volume: 0,
    fees: 0,
    gas: 0,
    drop: 0,
    booster: 0,
    pointsEarned: 0,
    pointsSpent: 0,
    pnl: 0,
  };
  for (const e of entries) {
    if (e.date < from || e.date > today) continue;
    sum.volume += e.volume;
    sum.fees += e.fee;
    sum.gas += e.gasExpense;
    sum.drop += e.dropIncome;
    sum.booster += e.boosterIncome;
    sum.pointsEarned += e.pointsPlus;
    sum.pointsSpent += e.pointsMinus;
    if (isActive(e)) sum.activeDays += 1;
  }
  sum.pnl = sum.drop + sum.booster - sum.fees - sum.gas;
  return sum;
}

export interface MonthResult {
  /** YYYY-MM */
  month: string;
  /** днів місяця в межах журналу: від першого запису до сьогодні */
  days: number;
  activeDays: number;
  volume: number;
  fees: number;
  gas: number;
  drop: number;
  booster: number;
  pointsEarned: number;
  pointsSpent: number;
  pnl: number;
  roi: number;
  adjustments: number;
  balanceStart: number;
  balanceEnd: number;
  /** залишок балів на кінець місяця (для поточного — на зараз) */
  pointsEnd: number;
}

function nextMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

/** Скільки днів місяця `ym` потрапляє в проміжок [from, to]. */
function daysInRange(ym: string, from: string, to: string): number {
  const [y, m] = ym.split('-').map(Number);
  const monthStart = `${ym}-01`;
  const monthEnd = `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
  const a = from > monthStart ? from : monthStart;
  const b = to < monthEnd ? to : monthEnd;
  if (a > b) return 0;
  // parseDate ставить полудень, тож перехід на літній час не зсуває день
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86_400_000) + 1;
}

/**
 * Результати по календарних місяцях, від найновішого. Місяці без жодного
 * запису всередині журналу теж є — з нулями, щоб пропуск було видно.
 * Для кожного місяця: balanceEnd − balanceStart = pnl + adjustments.
 */
export function monthlyResults(
  entries: Entry[],
  s: AccountParams,
  today = todayISO(),
  adjustments: BalanceAdjustment[] = []
): MonthResult[] {
  const days = journalDays(entries, adjustments);
  if (days.length === 0) return [];
  const first = days[0].date;
  const lastDate = days[days.length - 1].date;
  const last = lastDate > today ? lastDate : today;

  const out: MonthResult[] = [];
  let balance = s.startBalance;
  let points = s.startPoints;
  let i = 0;
  for (let month = first.slice(0, 7); month <= last.slice(0, 7); month = nextMonth(month)) {
    const r: MonthResult = {
      month,
      days: daysInRange(month, first, last),
      activeDays: 0,
      volume: 0,
      fees: 0,
      gas: 0,
      drop: 0,
      booster: 0,
      pointsEarned: 0,
      pointsSpent: 0,
      pnl: 0,
      roi: 0,
      adjustments: 0,
      balanceStart: balance,
      balanceEnd: balance,
      pointsEnd: points,
    };
    for (; i < days.length && days[i].date.slice(0, 7) === month; i++) {
      const { entry: e, adjustment } = days[i];
      balance += adjustment;
      r.adjustments += adjustment;
      if (!e) continue;
      balance += entryBalanceDelta(e);
      points += e.pointsPlus - e.pointsMinus;
      r.volume += e.volume;
      r.fees += e.fee;
      r.gas += e.gasExpense;
      r.drop += e.dropIncome;
      r.booster += e.boosterIncome;
      r.pointsEarned += e.pointsPlus;
      r.pointsSpent += e.pointsMinus;
      if (isActive(e)) r.activeDays += 1;
    }
    r.pnl = r.drop + r.booster - r.fees - r.gas;
    const costs = r.fees + r.gas;
    r.roi = costs === 0 ? 0 : r.pnl / costs;
    r.balanceEnd = balance;
    r.pointsEnd = points;
    out.push(r);
  }
  return out.reverse();
}

/** Прогноз: скільки балів буде через n днів за поточного темпу. */
export function forecastPoints(stats: Stats, s: AccountParams, n: number): number {
  return Math.round(stats.points + s.defaultPoints * n);
}

/** Через скільки днів набереться target балів (null — якщо темп нульовий або вже досягнуто). */
export function daysToPoints(stats: Stats, s: AccountParams, target: number): number | null {
  if (target <= stats.points) return 0;
  if (s.defaultPoints <= 0) return null;
  return Math.ceil((target - stats.points) / s.defaultPoints);
}

/** Акаунти, у яких за дату `date` немає прокруту (активного запису). */
export function accountsMissing<A extends { id: number }>(
  accounts: A[],
  entriesByAccount: EntriesByAccount,
  date: string
): A[] {
  return accounts.filter(
    (a) => !(entriesByAccount[a.id] ?? []).some((e) => e.date === date && isActive(e))
  );
}
