import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { csvToJournal, journalToCsv } from './csv';
import { fileSlug, todayISO } from './format';
import type { Journal } from './types';

export async function shareCsv(journal: Journal, accountName: string): Promise<void> {
  const file = new File(
    Paths.cache,
    `cryptofinance-tracker-${fileSlug(accountName)}-${todayISO()}.csv`
  );
  if (file.exists) file.delete();
  file.create();
  file.write(journalToCsv(journal));
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    dialogTitle: 'Експорт журналу',
  });
}

/** Відкриває пікер файлів і повертає розібраний журнал (null — якщо скасовано). */
export async function pickCsvJournal(): Promise<Journal | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/csv'],
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets?.length) return null;
  const text = await new File(res.assets[0].uri).text();
  return csvToJournal(text);
}
