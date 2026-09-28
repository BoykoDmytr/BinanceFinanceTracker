/**
 * Звіряє розрахунки застосунку з контрольними цифрами з Excel-таблиці
 * (стан на 21.08.2026). Запуск: npm run test:calc
 *
 * Примітка: у таблиці 12.07 стояло «Бали − = −1» (корекція +1 бал). У seed
 * вона перенесена в «Бали +» (18 замість 17−(−1)), тому суми зароблених /
 * витрачених балів тут 885/645 проти 884/644 у таблиці — підсумковий
 * залишок балів (240) від цього не змінюється.
 */
import {
  accountsMissing,
  computeStats,
  daysToPoints,
  forecastPoints,
  periodSummary,
} from '../src/lib/calc';
import { fileSlug } from '../src/lib/format';
import { SEED_ENTRIES, SEED_SETTINGS } from '../src/lib/seed';
import type { AccountParams, Entry } from '../src/lib/types';

const settings: AccountParams = SEED_SETTINGS;

const stats = computeStats(SEED_ENTRIES, settings, '2026-08-21');

let failed = 0;
function check(name: string, actual: number, expected: number, eps = 0.005) {
  const ok = Math.abs(actual - expected) <= eps;
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${name}: ${actual}${ok ? '' : ` (очікувалось ${expected})`}`);
}
function checkEq(name: string, actual: string, expected: string) {
  const ok = actual === expected;
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

// мультиакаунт: журнали акаунтів незалежні, нагадування — про незаписані
const second: Entry[] = [
  { ...SEED_ENTRIES[0], date: '2026-08-20', fee: 3, dropIncome: 10 },
  { ...SEED_ENTRIES[0], date: '2026-08-21', volume: 0, fee: 0, comment: 'лише коментар' },
];
const byAccount = { 1: SEED_ENTRIES, 2: second };
const statsSecond = computeStats(second, { startBalance: 500, startPoints: 5, defaultPoints: 15 }, '2026-08-21');
check('2-й акаунт: баланс від власного старту', statsSecond.balance, 500 - 3 + 10);
check('2-й акаунт: не прокручено 21.08 (порожній день)', statsSecond.todayLogged ? 1 : 0, 0, 0);
check('1-й акаунт не змінився', computeStats(byAccount[1], settings, '2026-08-21').balance, 1154.14);
const accs = [{ id: 1 }, { id: 2 }, { id: 3 }];
const missing = (date: string) => accountsMissing(accs, byAccount, date).map((a) => a.id).join(',');
checkEq('Не записано 21.08 (порожній день не рахується)', missing('2026-08-21'), '2,3');
checkEq('Не записано 20.08', missing('2026-08-20'), '3');
checkEq('Не записано 22.08', missing('2026-08-22'), '1,2,3');

// ім'я файлу експорту: лише безпечні символи, кирилиця лишається
checkEq('Файл: кирилиця і пробіли', fileSlug('Телефон мами (Ґалина)'), 'Телефон-мами-Ґалина');
checkEq('Файл: дужки й спецсимволи', fileSlug('[Samsung] #2 / 50%'), 'Samsung-2-50');
checkEq('Файл: лише спецсимволи', fileSlug(' ?*[] '), 'account');

if (failed > 0) {
  console.error(`\n${failed} перевірок не пройшло`);
  process.exit(1);
}
console.log('\nУсі розрахунки збігаються ✓');
