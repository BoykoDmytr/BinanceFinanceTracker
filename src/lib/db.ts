import * as SQLite from 'expo-sqlite';

import { SEED_ENTRIES, SEED_SETTINGS } from './seed';
import type { Entry, Post, Reminder, ReminderKind, Settings } from './types';

const db = SQLite.openDatabaseSync('cryptohornet.db');

export function initDb(): void {
  db.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS entries (
      date TEXT PRIMARY KEY,
      volume REAL NOT NULL DEFAULT 0,
      fee REAL NOT NULL DEFAULT 0,
      points_plus INTEGER NOT NULL DEFAULT 0,
      points_minus INTEGER NOT NULL DEFAULT 0,
      drop_income REAL NOT NULL DEFAULT 0,
      gas_expense REAL NOT NULL DEFAULT 0,
      comment TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      kind TEXT NOT NULL DEFAULT 'daily',
      time TEXT NOT NULL DEFAULT '12:00',
      weekdays TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1,
      post_id INTEGER,
      notif_ids TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  seedIfNeeded();
}

function seedIfNeeded(): void {
  const seeded = getSetting('seeded');
  if (seeded === '1') return;
  db.withTransactionSync(() => {
    for (const e of SEED_ENTRIES) upsertEntry(e);
    setSetting('start_balance', String(SEED_SETTINGS.startBalance));
    setSetting('start_points', String(SEED_SETTINGS.startPoints));
    setSetting('default_points', String(SEED_SETTINGS.defaultPoints));
    setSetting('seeded', '1');
  });
}

// ---------- settings ----------

function getSetting(key: string): string | null {
  const row = db.getFirstSync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? row.value : null;
}

function setSetting(key: string, value: string): void {
  db.runSync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  );
}

export function loadSettings(): Settings {
  const numOr = (key: string, fallback: number) => {
    const v = getSetting(key);
    const n = v === null ? NaN : Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  return {
    startBalance: numOr('start_balance', SEED_SETTINGS.startBalance),
    startPoints: numOr('start_points', SEED_SETTINGS.startPoints),
    defaultPoints: numOr('default_points', SEED_SETTINGS.defaultPoints),
    spinReminderEnabled: getSetting('spin_reminder_enabled') !== '0',
    spinReminderTime: getSetting('spin_reminder_time') ?? '20:00',
    spinReminderRepeat: getSetting('spin_reminder_repeat') !== '0',
  };
}

export function saveSettings(s: Settings): void {
  db.withTransactionSync(() => {
    setSetting('start_balance', String(s.startBalance));
    setSetting('start_points', String(s.startPoints));
    setSetting('default_points', String(s.defaultPoints));
    setSetting('spin_reminder_enabled', s.spinReminderEnabled ? '1' : '0');
    setSetting('spin_reminder_time', s.spinReminderTime);
    setSetting('spin_reminder_repeat', s.spinReminderRepeat ? '1' : '0');
  });
}

// ---------- entries ----------

interface EntryRow {
  date: string;
  volume: number;
  fee: number;
  points_plus: number;
  points_minus: number;
  drop_income: number;
  gas_expense: number;
  comment: string;
}

function rowToEntry(r: EntryRow): Entry {
  return {
    date: r.date,
    volume: r.volume,
    fee: r.fee,
    pointsPlus: r.points_plus,
    pointsMinus: r.points_minus,
    dropIncome: r.drop_income,
    gasExpense: r.gas_expense,
    comment: r.comment,
  };
}

export function loadEntries(): Entry[] {
  const rows = db.getAllSync<EntryRow>('SELECT * FROM entries ORDER BY date ASC');
  return rows.map(rowToEntry);
}

export function upsertEntry(e: Entry): void {
  db.runSync(
    `INSERT INTO entries (date, volume, fee, points_plus, points_minus, drop_income, gas_expense, comment)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       volume = excluded.volume,
       fee = excluded.fee,
       points_plus = excluded.points_plus,
       points_minus = excluded.points_minus,
       drop_income = excluded.drop_income,
       gas_expense = excluded.gas_expense,
       comment = excluded.comment`,
    [e.date, e.volume, e.fee, e.pointsPlus, e.pointsMinus, e.dropIncome, e.gasExpense, e.comment]
  );
}

export function deleteEntry(date: string): void {
  db.runSync('DELETE FROM entries WHERE date = ?', [date]);
}

// ---------- reminders ----------

interface ReminderRow {
  id: number;
  title: string;
  body: string;
  kind: string;
  time: string;
  weekdays: string;
  date: string;
  enabled: number;
  post_id: number | null;
  notif_ids: string;
}

function rowToReminder(r: ReminderRow): Reminder {
  let notifIds: string[] = [];
  try {
    const parsed = JSON.parse(r.notif_ids);
    if (Array.isArray(parsed)) notifIds = parsed.filter((x) => typeof x === 'string');
  } catch {
    // зіпсований запис — просто вважаємо, що нічого не заплановано
  }
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    kind: (['daily', 'weekly', 'once'].includes(r.kind) ? r.kind : 'daily') as ReminderKind,
    time: r.time,
    weekdays: r.weekdays
      ? r.weekdays
          .split(',')
          .map(Number)
          .filter((n) => n >= 1 && n <= 7)
      : [],
    date: r.date,
    enabled: r.enabled === 1,
    postId: r.post_id,
    notifIds,
  };
}

export function loadReminders(): Reminder[] {
  const rows = db.getAllSync<ReminderRow>('SELECT * FROM reminders ORDER BY id ASC');
  return rows.map(rowToReminder);
}

export function insertReminder(r: Omit<Reminder, 'id'>): Reminder {
  const res = db.runSync(
    `INSERT INTO reminders (title, body, kind, time, weekdays, date, enabled, post_id, notif_ids)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      r.title,
      r.body,
      r.kind,
      r.time,
      r.weekdays.join(','),
      r.date,
      r.enabled ? 1 : 0,
      r.postId,
      JSON.stringify(r.notifIds),
    ]
  );
  return { ...r, id: Number(res.lastInsertRowId) };
}

export function updateReminder(r: Reminder): void {
  db.runSync(
    `UPDATE reminders SET title = ?, body = ?, kind = ?, time = ?, weekdays = ?, date = ?,
       enabled = ?, post_id = ?, notif_ids = ? WHERE id = ?`,
    [
      r.title,
      r.body,
      r.kind,
      r.time,
      r.weekdays.join(','),
      r.date,
      r.enabled ? 1 : 0,
      r.postId,
      JSON.stringify(r.notifIds),
      r.id,
    ]
  );
}

export function deleteReminder(id: number): void {
  db.runSync('DELETE FROM reminders WHERE id = ?', [id]);
}

// ---------- posts ----------

interface PostRow {
  id: number;
  title: string;
  content: string;
  status: string;
  created_at: string;
  updated_at: string;
}

function rowToPost(r: PostRow): Post {
  return {
    id: r.id,
    title: r.title,
    content: r.content,
    status: r.status === 'published' ? 'published' : 'draft',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function loadPosts(): Post[] {
  const rows = db.getAllSync<PostRow>('SELECT * FROM posts ORDER BY updated_at DESC');
  return rows.map(rowToPost);
}

export function insertPost(p: Omit<Post, 'id'>): Post {
  const res = db.runSync(
    'INSERT INTO posts (title, content, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [p.title, p.content, p.status, p.createdAt, p.updatedAt]
  );
  return { ...p, id: Number(res.lastInsertRowId) };
}

export function updatePost(p: Post): void {
  db.runSync('UPDATE posts SET title = ?, content = ?, status = ?, updated_at = ? WHERE id = ?', [
    p.title,
    p.content,
    p.status,
    p.updatedAt,
    p.id,
  ]);
}

export function deletePost(id: number): void {
  db.runSync('DELETE FROM posts WHERE id = ?', [id]);
}
