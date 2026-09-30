// CSV-формат журналу (експорт/імпорт). Без залежностей від Expo — щоб
// звірятись у scripts/check-calc.ts.
import { sortByDate } from './calc';
import type { BalanceAdjustment, Entry, Journal } from './types';

const HEADERS = {
  date: 'Дата',
  volume: 'Обсяг торгівлі, $',
  fee: 'Комісія, $',
  pointsPlus: 'Бали +',
  pointsMinus: 'Бали −',
  dropIncome: 'Дохід з дропу, $',
  boosterIncome: 'Дохід з бустерів, $',
  gasExpense: 'Витрати (газ/фі), $',
  comment: 'Коментар',
  adjustment: 'Корекція балансу, $',
} as const;

function csvCell(v: string): string {
  if (/[",\n;]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
  return v;
}

/**
 * Журнал акаунта → CSV. Корекція балансу — остання колонка; день, у який є
 * лише корекція, йде рядком з порожніми клітинками запису (не нулями), щоб
 * імпорт не створив з нього запис.
 */
export function journalToCsv({ entries, adjustments }: Journal): string {
  const header = Object.values(HEADERS).map(csvCell).join(',');
  const byDate = new Map(sortByDate(entries).map((e) => [e.date, e]));
  const adjByDate = new Map(adjustments.map((a) => [a.date, a.amount]));
  const dates = [...new Set([...byDate.keys(), ...adjByDate.keys()])].sort();
  const lines = dates.map((date) => {
    const e = byDate.get(date);
    const adj = adjByDate.get(date);
    const adjCell = adj === undefined ? '' : String(adj);
    if (!e) return [date, '', '', '', '', '', '', '', '', adjCell].join(',');
    return [
      e.date,
      String(e.volume),
      String(e.fee),
      String(e.pointsPlus),
      String(e.pointsMinus),
      String(e.dropIncome),
      String(e.boosterIncome),
      String(e.gasExpense),
      csvCell(e.comment),
      adjCell,
    ].join(',');
  });
  // BOM — щоб Excel коректно відкрив кирилицю
  return '\uFEFF' + header + '\n' + lines.join('\n') + '\n';
}

// ---------- імпорт ----------

/** Розбирає CSV-текст на рядки клітинок з підтримкою лапок ("" всередині). */
function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

function toNum(s: string | undefined): number {
  if (!s) return 0;
  const n = Number(s.trim().replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function toIsoDate(s: string): string | null {
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

/**
 * Читає CSV нашого формату експорту (старі файли без колонок бустерів і
 * корекцій теж підтримуються). Повертає записи й корекції або кидає помилку з
 * поясненням.
 */
export function csvToJournal(text: string): Journal {
  const rows = parseCsvText(text);
  if (rows.length < 2) throw new Error('Файл порожній або без даних.');

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.findIndex((h) => h === name.toLowerCase());
  const iDate = col(HEADERS.date);
  if (iDate === -1) throw new Error('Не знайдено колонку «Дата» — це не файл експорту журналу.');
  const iVolume = col(HEADERS.volume);
  const iFee = col(HEADERS.fee);
  const iPlus = col(HEADERS.pointsPlus);
  const iMinus = col(HEADERS.pointsMinus);
  const iDrop = col(HEADERS.dropIncome);
  const iBooster = col(HEADERS.boosterIncome);
  const iGas = col(HEADERS.gasExpense);
  const iComment = col(HEADERS.comment);
  const iAdj = col(HEADERS.adjustment);
  const entryCols = [iVolume, iFee, iPlus, iMinus, iDrop, iBooster, iGas, iComment];
  const cell = (row: string[], i: number) => (i === -1 ? '' : (row[i] ?? '').trim());

  const entries: Entry[] = [];
  const adjustments: BalanceAdjustment[] = [];
  for (const row of rows.slice(1)) {
    const date = toIsoDate(row[iDate] ?? '');
    if (!date) continue;
    const adjCell = cell(row, iAdj);
    // рядок лише з корекцією: усі клітинки запису порожні
    const onlyAdjustment = adjCell !== '' && entryCols.every((i) => cell(row, i) === '');
    if (!onlyAdjustment) {
      entries.push({
        date,
        volume: toNum(row[iVolume]),
        fee: toNum(row[iFee]),
        pointsPlus: Math.round(toNum(row[iPlus])),
        pointsMinus: Math.round(toNum(row[iMinus])),
        dropIncome: toNum(row[iDrop]),
        boosterIncome: iBooster === -1 ? 0 : toNum(row[iBooster]),
        gasExpense: toNum(row[iGas]),
        comment: cell(row, iComment),
      });
    }
    if (adjCell !== '') adjustments.push({ date, amount: toNum(adjCell) });
  }
  if (entries.length === 0 && adjustments.length === 0) {
    throw new Error('У файлі не знайдено жодного запису з датою.');
  }
  return { entries, adjustments };
}
