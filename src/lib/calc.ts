import { addDays, todayISO } from './format';
import type { Entry, Settings } from './types';

export interface DayPoint {
  date: string;
  balance: number;
  points: number;
  volume: number;
}

export interface DropDay {
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
  activeDays: number;
  pointsEarned: number;
  pointsSpent: number;
  avgPointsPerDay: number;
  costPerPoint: number;
  streak: number;
  todayLogged: boolean;
  series: DayPoint[];
  drops: DropDay[];
}

export function sortByDate(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** День вважається «прокрученим», якщо в ньому є фактична активність. */
export function isActive(e: Entry): boolean {
  return e.volume > 0 || e.fee > 0 || e.dropIncome > 0;
}

/**
 * Та сама математика, що й у Excel-таблиці:
 *  Баланс = старт − Σкомісій − Σгазу + Σдоходів з дропів
 *  Бали   = старт + Σ(бали+) − Σ(бали−)
 *  P&L    = Σдропів − Σкомісій − Σгазу
 *  ROI    = P&L / (Σкомісій + Σгазу)
 */
export function computeStats(entries: Entry[], s: Settings, today = todayISO()): Stats {
  const sorted = sortByDate(entries);

  let balance = s.startBalance;
  let points = s.startPoints;
  let totalVolume = 0;
  let totalFees = 0;
  let totalGas = 0;
  let totalDrop = 0;
  let pointsEarned = 0;
  let pointsSpent = 0;
  let activeDays = 0;

  const series: DayPoint[] = [];
  const drops: DropDay[] = [];

  for (const e of sorted) {
    balance += e.dropIncome - e.fee - e.gasExpense;
    points += e.pointsPlus - e.pointsMinus;
    totalVolume += e.volume;
    totalFees += e.fee;
    totalGas += e.gasExpense;
    totalDrop += e.dropIncome;
    pointsEarned += e.pointsPlus;
    pointsSpent += e.pointsMinus;
    if (isActive(e)) activeDays += 1;
    series.push({ date: e.date, balance, points, volume: e.volume });
    if (e.dropIncome > 0) {
      drops.push({ date: e.date, income: e.dropIncome, pointsSpent: e.pointsMinus, comment: e.comment });
    }
  }

  const pnl = totalDrop - totalFees - totalGas;
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
    activeDays,
    pointsEarned,
    pointsSpent,
    avgPointsPerDay: activeDays === 0 ? 0 : pointsEarned / activeDays,
    costPerPoint: pointsEarned === 0 ? 0 : totalFees / pointsEarned,
    streak,
    todayLogged,
    series,
    drops: drops.reverse(),
  };
}

/** Прогноз: скільки балів буде через n днів за поточного темпу. */
export function forecastPoints(stats: Stats, s: Settings, n: number): number {
  return Math.round(stats.points + s.defaultPoints * n);
}

/** Через скільки днів набереться target балів (null — якщо темп нульовий або вже досягнуто). */
export function daysToPoints(stats: Stats, s: Settings, target: number): number | null {
  if (target <= stats.points) return 0;
  if (s.defaultPoints <= 0) return null;
  return Math.ceil((target - stats.points) / s.defaultPoints);
}
