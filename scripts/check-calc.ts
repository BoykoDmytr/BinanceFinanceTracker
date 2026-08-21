/**
 * Звіряє розрахунки застосунку з контрольними цифрами з Excel-таблиці
 * «CRYPTO HORNET» (стан на 21.08.2026). Запуск: npm run test:calc
 */
import { computeStats, daysToPoints, forecastPoints } from '../src/lib/calc';
import { SEED_ENTRIES, SEED_SETTINGS } from '../src/lib/seed';
import type { Settings } from '../src/lib/types';

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
check('Активні дні', stats.activeDays, 52, 0);
check('Бали зароблено', stats.pointsEarned, 884, 0);
check('Бали витрачено', stats.pointsSpent, 644, 0);
check('ROI (Excel C24)', stats.roi, 54.14 / 103.24, 0.0001);
check('Собівартість бала', stats.costPerPoint, 100.26 / 884, 0.0001);
check('Стрік (всі 52 дні підряд)', stats.streak, 52, 0);
check('Сьогодні записано', stats.todayLogged ? 1 : 0, 1, 0);
check('Прогноз +7 днів', forecastPoints(stats, settings, 7), 240 + 17 * 7, 0);
check('Днів до 500 балів', daysToPoints(stats, settings, 500) ?? -1, Math.ceil(260 / 17), 0);

// стрік не втрачається, якщо сьогодні ще не записано, але вчора було
const statsNext = computeStats(SEED_ENTRIES, settings, '2026-08-22');
check('Стрік наступного ранку', statsNext.streak, 52, 0);
check('22.08 ще не записано', statsNext.todayLogged ? 1 : 0, 0, 0);

if (failed > 0) {
  console.error(`\n${failed} перевірок не пройшло`);
  process.exit(1);
}
console.log('\nУсі розрахунки збігаються з таблицею ✓');
