/**
 * Звіряє розрахунки застосунку з контрольними цифрами з Excel-таблиці
 * (стан на 21.08.2026). Запуск: npm run test:calc
 *
 * Примітка: у таблиці 12.07 стояло «Бали − = −1» (корекція +1 бал). У seed
 * вона перенесена в «Бали +» (18 замість 17−(−1)), тому суми зароблених /
 * витрачених балів тут 885/645 проти 884/644 у таблиці — підсумковий
 * залишок балів (240) від цього не змінюється.
 */
import { computeStats, daysToPoints, forecastPoints, periodSummary } from '../src/lib/calc';
import { SEED_ENTRIES, SEED_SETTINGS } from '../src/lib/seed';
import type { Entry, Settings } from '../src/lib/types';

const settings: Settings = {
  ...SEED_SETTINGS,
  spinReminderEnabled: true,
  spinReminderTime: '20:00',
  spinReminderRepeat: true,
};

const stats = computeStats(SEED_ENTRIES, settings, '2026-08-21');

let failed = 0;
function check(name: string, actual: number, expected: number, eps = 0.005) {
  const ok = Math.abs(actual - expected) <= eps;
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${name}: ${actual}${ok ? '' : ` (очікувалось ${expected})`}`);
}

check('Баланс (Excel H53)', stats.balance, 1154.14);
check('Бали (Excel I53)', stats.points, 240, 0);
check('P&L (Excel C12)', stats.pnl, 54.14);
check('Обсяг (Excel C15)', stats.totalVolume, 1910429.92);
check('Комісії (Excel C16)', stats.totalFees, 100.26);
check('Газ (Excel C17)', stats.totalGas, 2.98);
check('Дохід з дропів (Excel C18)', stats.totalDrop, 157.38);
check('Дохід з бустерів (у таблиці не вівся)', stats.totalBooster, 0, 0);
check('Активні дні', stats.activeDays, 52, 0);
check('Бали зароблено (884 + корекція 12.07)', stats.pointsEarned, 885, 0);
check('Бали витрачено (644 + корекція 12.07)', stats.pointsSpent, 645, 0);
check('ROI (Excel C24)', stats.roi, 54.14 / 103.24, 0.0001);
check('Собівартість бала', stats.costPerPoint, 100.26 / 885, 0.0001);
check('Стрік (всі 52 дні підряд)', stats.streak, 52, 0);
check('Сьогодні записано', stats.todayLogged ? 1 : 0, 1, 0);
check('Прогноз +7 днів', forecastPoints(stats, settings, 7), 240 + 17 * 7, 0);
check('Днів до 500 балів', daysToPoints(stats, settings, 500) ?? -1, Math.ceil(260 / 17), 0);

// стрік не втрачається, якщо сьогодні ще не записано, але вчора було
const statsNext = computeStats(SEED_ENTRIES, settings, '2026-08-22');
check('Стрік наступного ранку', statsNext.streak, 52, 0);
check('22.08 ще не записано', statsNext.todayLogged ? 1 : 0, 0, 0);

// бустери: впливають на баланс і P&L, live в окремому списку
const withBooster: Entry[] = [
  ...SEED_ENTRIES,
  {
    date: '2026-08-22',
    volume: 30000,
    fee: 2,
    pointsPlus: 17,
    pointsMinus: 0,
    dropIncome: 0,
    boosterIncome: 25,
    gasExpense: 0,
    comment: 'booster тест',
  },
];
const statsB = computeStats(withBooster, settings, '2026-08-22');
check('Бустер: баланс', statsB.balance, 1154.14 - 2 + 25);
check('Бустер: P&L', statsB.pnl, 54.14 - 2 + 25);
check('Бустер: сума бустерів', statsB.totalBooster, 25);
check('Бустер: у списку бустерів', statsB.boosters.length, 1, 0);
check('Бустер: не потрапив у дропи', statsB.drops.length, stats.drops.length, 0);

// підсумок за 15 днів (07.08–21.08): рахуємо очікування напряму з seed
const from = '2026-08-07';
const win = SEED_ENTRIES.filter((e) => e.date >= from && e.date <= '2026-08-21');
const sum15 = periodSummary(SEED_ENTRIES, 15, '2026-08-21');
check('15 днів: активних', sum15.activeDays, win.length, 0);
check('15 днів: обсяг', sum15.volume, win.reduce((a, e) => a + e.volume, 0));
check('15 днів: комісії', sum15.fees, win.reduce((a, e) => a + e.fee, 0));
check(
  '15 днів: P&L',
  sum15.pnl,
  win.reduce((a, e) => a + e.dropIncome + e.boosterIncome - e.fee - e.gasExpense, 0)
);

if (failed > 0) {
  console.error(`\n${failed} перевірок не пройшло`);
  process.exit(1);
}
console.log('\nУсі розрахунки збігаються ✓');
