import * as SQLite from 'expo-sqlite';

import { SEED_ENTRIES, SEED_SETTINGS } from './seed';
import type {
  Account,
  AdjustmentsByAccount,
  BalanceAdjustment,
  EntriesByAccount,
  Entry,
  Post,
  Reminder,
  ReminderKind,
  Settings,
} from './types';

const db = SQLite.openDatabaseSync('cryptohornet.db');

const DEFAULT_ACCOUNT_NAME = 'Основний акаунт';

// Один день журналу — один рядок на акаунт.
function entriesTableSql(name: string): string {
  return `
    CREATE TABLE IF NOT EXISTS ${name} (
      account_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      volume REAL NOT NULL DEFAULT 0,
      fee REAL NOT NULL DEFAULT 0,
      points_plus INTEGER NOT NULL DEFAULT 0,
      points_minus INTEGER NOT NULL DEFAULT 0,
      drop_income REAL NOT NULL DEFAULT 0,
      booster_income REAL NOT NULL DEFAULT 0,
      gas_expense REAL NOT NULL DEFAULT 0,
      comment TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (account_id, date)
    );`;
}

export function initDb(): void {
  db.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      start_balance REAL NOT NULL DEFAULT 0,
      start_points INTEGER NOT NULL DEFAULT 0,
      default_points INTEGER NOT NULL DEFAULT 0,
      spin_reminder INTEGER NOT NULL DEFAULT 1
    );
    ${entriesTableSql('entries')}
    -- Корекції балансу живуть окремо від журналу: редагування чи видалення
    -- запису дня їх не зачіпає. Одна корекція на акаунт і дату.
    CREATE TABLE IF NOT EXISTS balance_adjustments (
      account_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      PRIMARY KEY (account_id, date)
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
      images TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  migrate();
  seedIfNeeded();
  ensureAccount();
}

function hasColumn(table: string, column: string): boolean {
  const cols = db.getAllSync<{ name: string }>(`PRAGMA table_info(${table})`);
  return cols.some((c) => c.name === column);
}

// Доводить базу, що лишилась від старішої версії застосунку, до поточної схеми.
function migrate(): void {
  const addColumn = (sql: string) => {
    try {
      db.execSync(sql);
    } catch {
      // колонка вже існує
    }
  };
  addColumn('ALTER TABLE entries ADD COLUMN booster_income REAL NOT NULL DEFAULT 0');
  addColumn("ALTER TABLE posts ADD COLUMN images TEXT NOT NULL DEFAULT '[]'");

  // До мультиакаунту журнал був один (ключ — лише дата). Первинний ключ у
  // SQLite змінити не можна, тому перебудовуємо таблицю, а всі наявні записи
  // переносимо в перший акаунт.
  if (!hasColumn('entries', 'account_id')) {
    db.withTransactionSync(() => {
      const accountId = ensureAccount();
      db.execSync(`DROP TABLE IF EXISTS entries_v2; ${entriesTableSql('entries_v2')}`);
      db.runSync(
        `INSERT INTO entries_v2 (account_id, date, volume, fee, points_plus, points_minus,
           drop_income, booster_income, gas_expense, comment)
         SELECT ?, date, volume, fee, points_plus, points_minus,
           drop_income, booster_income, gas_expense, comment
         FROM entries`,
        [accountId]
      );
      db.execSync('DROP TABLE entries; ALTER TABLE entries_v2 RENAME TO entries;');
    });
  }
}

function seedIfNeeded(): void {
  if (getSetting('seeded') === '1') return;
  db.withTransactionSync(() => {
    const accountId = ensureAccount();
    for (const e of SEED_ENTRIES) upsertEntry(accountId, e);
    setSetting('seeded', '1');
  });
}

/**
 * Гарантує, що є хоча б один акаунт, і повертає id першого. Якщо акаунтів ще
 * немає (перший запуск або оновлення зі старої версії) — створює основний
 * зі стартовими значеннями, які раніше жили в налаштуваннях.
 */
function ensureAccount(): number {
  const first = db.getFirstSync<{ id: number }>('SELECT id FROM accounts ORDER BY id ASC LIMIT 1');
  if (first) return first.id;
  const numOr = (key: string, fallback: number) => {
    const v = getSetting(key);
    const n = v === null ? NaN : Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  return insertAccount({
    name: DEFAULT_ACCOUNT_NAME,
    startBalance: numOr('start_balance', SEED_SETTINGS.startBalance),
    startPoints: numOr('start_points', SEED_SETTINGS.startPoints),
    defaultPoints: numOr('default_points', SEED_SETTINGS.defaultPoints),
    spinReminder: true,
  }).id;
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
  return {
    spinReminderEnabled: getSetting('spin_reminder_enabled') !== '0',
    spinReminderTime: getSetting('spin_reminder_time') ?? '20:00',
    spinReminderRepeat: getSetting('spin_reminder_repeat') !== '0',
  };
}

export function saveSettings(s: Settings): void {
  db.withTransactionSync(() => {
    setSetting('spin_reminder_enabled', s.spinReminderEnabled ? '1' : '0');
    setSetting('spin_reminder_time', s.spinReminderTime);
    setSetting('spin_reminder_repeat', s.spinReminderRepeat ? '1' : '0');
  });
}

/** id активного акаунта; якщо збережений id вже не існує — перший акаунт. */
export function loadActiveAccountId(accounts: Account[]): number {
  const saved = Number(getSetting('active_account_id'));
  return accounts.some((a) => a.id === saved) ? saved : accounts[0].id;
}

export function saveActiveAccountId(id: number): void {
  setSetting('active_account_id', String(id));
}

// ---------- accounts ----------

interface AccountRow {
  id: number;
  name: string;
  start_balance: number;
  start_points: number;
  default_points: number;
  spin_reminder: number;
}

function rowToAccount(r: AccountRow): Account {
  return {
    id: r.id,
    name: r.name,
    startBalance: r.start_balance,
    startPoints: r.start_points,
    defaultPoints: r.default_points,
    spinReminder: r.spin_reminder === 1,
  };
}

export function loadAccounts(): Account[] {
  const rows = db.getAllSync<AccountRow>('SELECT * FROM accounts ORDER BY id ASC');
  return rows.map(rowToAccount);
}

export function insertAccount(a: Omit<Account, 'id'>): Account {
  const res = db.runSync(
    `INSERT INTO accounts (name, start_balance, start_points, default_points, spin_reminder)
     VALUES (?, ?, ?, ?, ?)`,
    [a.name, a.startBalance, a.startPoints, a.defaultPoints, a.spinReminder ? 1 : 0]
  );
  return { ...a, id: Number(res.lastInsertRowId) };
}

export function updateAccount(a: Account): void {
  db.runSync(
    `UPDATE accounts SET name = ?, start_balance = ?, start_points = ?, default_points = ?,
       spin_reminder = ? WHERE id = ?`,
    [a.name, a.startBalance, a.startPoints, a.defaultPoints, a.spinReminder ? 1 : 0, a.id]
  );
}

/** Видаляє акаунт разом з усім його журналом і корекціями. */
export function deleteAccount(id: number): void {
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM entries WHERE account_id = ?', [id]);
    db.runSync('DELETE FROM balance_adjustments WHERE account_id = ?', [id]);
    db.runSync('DELETE FROM accounts WHERE id = ?', [id]);
  });
}

// ---------- entries ----------

interface EntryRow {
  account_id: number;
  date: string;
  volume: number;
  fee: number;
  points_plus: number;
  points_minus: number;
  drop_income: number;
  booster_income: number;
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
    boosterIncome: r.booster_income,
    gasExpense: r.gas_expense,
    comment: r.comment,
  };
}

/** Журнали всіх акаунтів, згруповані за id акаунта (кожен — за датою). */
export function loadEntriesByAccount(): EntriesByAccount {
  const rows = db.getAllSync<EntryRow>('SELECT * FROM entries ORDER BY account_id ASC, date ASC');
  const out: EntriesByAccount = {};
  for (const r of rows) (out[r.account_id] ??= []).push(rowToEntry(r));
  return out;
}

export function upsertEntry(accountId: number, e: Entry): void {
  db.runSync(
    `INSERT INTO entries (account_id, date, volume, fee, points_plus, points_minus, drop_income, booster_income, gas_expense, comment)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(account_id, date) DO UPDATE SET
       volume = excluded.volume,
       fee = excluded.fee,
       points_plus = excluded.points_plus,
       points_minus = excluded.points_minus,
       drop_income = excluded.drop_income,
       booster_income = excluded.booster_income,
       gas_expense = excluded.gas_expense,
       comment = excluded.comment`,
    [
      accountId,
      e.date,
      e.volume,
      e.fee,
      e.pointsPlus,
      e.pointsMinus,
      e.dropIncome,
      e.boosterIncome,
      e.gasExpense,
      e.comment,
    ]
  );
}

/** Імпорт: записи й корекції з тими самими датами перезаписуються, решта лишається. */
export function importJournal(
  accountId: number,
  entries: Entry[],
  adjustments: BalanceAdjustment[]
): void {
  db.withTransactionSync(() => {
    for (const e of entries) upsertEntry(accountId, e);
    for (const a of adjustments) setAdjustment(accountId, a.date, a.amount);
  });
}

export function deleteEntry(accountId: number, date: string): void {
  db.runSync('DELETE FROM entries WHERE account_id = ? AND date = ?', [accountId, date]);
}

// ---------- balance adjustments ----------

/** Корекції балансу всіх акаунтів, згруповані за id акаунта (кожні — за датою). */
export function loadAdjustmentsByAccount(): AdjustmentsByAccount {
  const rows = db.getAllSync<{ account_id: number; date: string; amount: number }>(
    'SELECT * FROM balance_adjustments ORDER BY account_id ASC, date ASC'
  );
  const out: AdjustmentsByAccount = {};
  for (const r of rows) (out[r.account_id] ??= []).push({ date: r.date, amount: r.amount });
  return out;
}

/** Встановлює корекцію за день; нульова сума прибирає її. */
export function setAdjustment(accountId: number, date: string, amount: number): void {
  if (amount === 0) {
    db.runSync('DELETE FROM balance_adjustments WHERE account_id = ? AND date = ?', [
      accountId,
      date,
    ]);
    return;
  }
  db.runSync(
    `INSERT INTO balance_adjustments (account_id, date, amount) VALUES (?, ?, ?)
     ON CONFLICT(account_id, date) DO UPDATE SET amount = excluded.amount`,
    [accountId, date, amount]
  );
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
  images: string;
  created_at: string;
  updated_at: string;
}

function rowToPost(r: PostRow): Post {
  let images: string[] = [];
  try {
    const parsed = JSON.parse(r.images);
    if (Array.isArray(parsed)) images = parsed.filter((x) => typeof x === 'string');
  } catch {
    // зіпсований запис — без картинок
  }
  return {
    id: r.id,
    title: r.title,
    content: r.content,
    status: r.status === 'published' ? 'published' : 'draft',
    images,
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
    'INSERT INTO posts (title, content, status, images, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [p.title, p.content, p.status, JSON.stringify(p.images), p.createdAt, p.updatedAt]
  );
  return { ...p, id: Number(res.lastInsertRowId) };
}

export function updatePost(p: Post): void {
  db.runSync(
    'UPDATE posts SET title = ?, content = ?, status = ?, images = ?, updated_at = ? WHERE id = ?',
    [p.title, p.content, p.status, JSON.stringify(p.images), p.updatedAt, p.id]
  );
}

export function deletePost(id: number): void {
  db.runSync('DELETE FROM posts WHERE id = ?', [id]);
}
