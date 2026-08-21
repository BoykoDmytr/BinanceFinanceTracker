import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { sortByDate } from './calc';
import { todayISO } from './format';
import type { Entry } from './types';

function csvCell(v: string): string {
  if (/[",\n;]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
  return v;
}

export function entriesToCsv(entries: Entry[]): string {
  const header = [
    'Дата',
    'Обсяг торгівлі, $',
    'Комісія, $',
    'Бали +',
    'Бали −',
    'Дохід з дропу, $',
    'Витрати (газ/фі), $',
    'Коментар',
  ].join(',');
  const lines = sortByDate(entries).map((e) =>
    [
      e.date,
      String(e.volume),
      String(e.fee),
      String(e.pointsPlus),
      String(e.pointsMinus),
      String(e.dropIncome),
      String(e.gasExpense),
      csvCell(e.comment),
    ].join(',')
  );
  // BOM — щоб Excel коректно відкрив кирилицю
  return '﻿' + header + '\n' + lines.join('\n') + '\n';
}

export async function shareCsv(entries: Entry[]): Promise<void> {
  const file = new File(Paths.cache, `crypto-hornet-${todayISO()}.csv`);
  if (file.exists) file.delete();
  file.create();
  file.write(entriesToCsv(entries));
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    dialogTitle: 'Експорт журналу',
  });
}
