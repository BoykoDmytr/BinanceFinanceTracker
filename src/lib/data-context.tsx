import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

import { computeStats, type Stats } from './calc';
import * as store from './db';
import { todayISO } from './format';
import { deleteImages } from './images';
import {
  cancelReminderNotifs,
  planSpinReminders,
  scheduleReminderNotifs,
  setupNotifications,
} from './notifications';
import type {
  Account,
  AdjustmentsByAccount,
  BalanceAdjustment,
  EntriesByAccount,
  Entry,
  Journal,
  Post,
  Reminder,
  Settings,
} from './types';

const NO_ENTRIES: Entry[] = [];
const NO_ADJUSTMENTS: BalanceAdjustment[] = [];

export interface AccountOverview {
  account: Account;
  stats: Stats;
}

interface DataContextValue {
  accounts: Account[];
  /** акаунт, з яким працюють дашборд, журнал і експорт */
  activeAccount: Account;
  /** підсумки кожного акаунта — для моніторингу всіх одразу */
  overview: AccountOverview[];
  /** журнал активного акаунта */
  entries: Entry[];
  /** журнали всіх акаунтів */
  entriesByAccount: EntriesByAccount;
  /** корекції балансу активного акаунта */
  adjustments: BalanceAdjustment[];
  /** корекції балансу всіх акаунтів */
  adjustmentsByAccount: AdjustmentsByAccount;
  settings: Settings;
  reminders: Reminder[];
  posts: Post[];
  /** статистика активного акаунта */
  stats: Stats;
  notifGranted: boolean;
  /** Поточна дата YYYY-MM-DD; оновлюється, коли застосунок виходить на передній план */
  today: string;

  setActiveAccount: (id: number) => void;
  addAccount: (a: Omit<Account, 'id'>) => Account;
  editAccount: (a: Account) => void;
  removeAccount: (id: number) => void;

  // запис завжди з явним акаунтом: форма не має писати в той, що став
  // активним уже після її відкриття (напр. через тап по сповіщенню)
  saveEntry: (accountId: number, e: Entry) => void;
  removeEntry: (accountId: number, date: string) => void;
  importJournal: (accountId: number, journal: Journal) => void;
  /** корекція балансу за день; 0 — прибрати */
  setBalanceAdjustment: (accountId: number, date: string, amount: number) => void;
  updateSettings: (s: Settings) => void;

  addReminder: (r: Omit<Reminder, 'id' | 'notifIds'>) => Promise<void>;
  editReminder: (r: Reminder) => Promise<void>;
  removeReminder: (id: number) => Promise<void>;

  addPost: (title: string, content: string, images?: string[]) => Post;
  editPost: (p: Post) => void;
  removePost: (id: number) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  // ініціалізація синхронна: SQLite відкривається і сідиться до першого рендера
  const [accounts, setAccounts] = useState<Account[]>(() => {
    store.initDb();
    return store.loadAccounts();
  });
  const [activeId, setActiveId] = useState(() => store.loadActiveAccountId(accounts));
  const [entriesByAccount, setEntriesByAccount] = useState<EntriesByAccount>(() =>
    store.loadEntriesByAccount()
  );
  const [adjustmentsByAccount, setAdjustmentsByAccount] = useState<AdjustmentsByAccount>(() =>
    store.loadAdjustmentsByAccount()
  );
  const [settings, setSettings] = useState<Settings>(() => store.loadSettings());
  const [reminders, setReminders] = useState<Reminder[]>(() => store.loadReminders());
  const [posts, setPosts] = useState<Post[]>(() => store.loadPosts());
  const [notifGranted, setNotifGranted] = useState(false);
  const grantedRef = useRef(false);

  // «Сьогодні» оновлюється при поверненні застосунку на передній план,
  // інакше після півночі дашборд показував би вчорашній день як сьогодні
  const [today, setToday] = useState(todayISO);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setToday(todayISO());
    });
    return () => sub.remove();
  }, []);

  // initDb гарантує хоча б один акаунт
  const activeAccount = accounts.find((a) => a.id === activeId) ?? accounts[0];
  const entries = entriesByAccount[activeAccount.id] ?? NO_ENTRIES;
  const adjustments = adjustmentsByAccount[activeAccount.id] ?? NO_ADJUSTMENTS;

  const overview = useMemo(
    () =>
      accounts.map((a) => ({
        account: a,
        stats: computeStats(
          entriesByAccount[a.id] ?? NO_ENTRIES,
          a,
          today,
          adjustmentsByAccount[a.id] ?? NO_ADJUSTMENTS
        ),
      })),
    [accounts, entriesByAccount, adjustmentsByAccount, today]
  );
  const stats = overview.find((o) => o.account.id === activeAccount.id)!.stats;

  useEffect(() => {
    (async () => {
      const granted = await setupNotifications();
      grantedRef.current = granted;
      setNotifGranted(granted);
    })();
  }, []);

  // Перепланувати «прокрут»-нагадування при зміні журналів, акаунтів, налаштувань чи дати
  useEffect(() => {
    if (!notifGranted) return;
    planSpinReminders(accounts, entriesByAccount, settings).catch(() => {});
  }, [accounts, entriesByAccount, settings, notifGranted, today]);

  const setActiveAccount = useCallback((id: number) => {
    store.saveActiveAccountId(id);
    setActiveId(id);
  }, []);

  const addAccount = useCallback((a: Omit<Account, 'id'>) => {
    const created = store.insertAccount(a);
    setAccounts(store.loadAccounts());
    return created;
  }, []);

  const editAccount = useCallback((a: Account) => {
    store.updateAccount(a);
    setAccounts(store.loadAccounts());
  }, []);

  const activeAccountId = activeAccount.id;

  const removeAccount = useCallback(
    (id: number) => {
      const rest = store.loadAccounts().filter((a) => a.id !== id);
      if (rest.length === 0) return; // останній акаунт не видаляємо
      store.deleteAccount(id);
      setAccounts(rest);
      setEntriesByAccount(store.loadEntriesByAccount());
      setAdjustmentsByAccount(store.loadAdjustmentsByAccount());
      if (id === activeAccountId) setActiveAccount(rest[0].id);
    },
    [activeAccountId, setActiveAccount]
  );

  const saveEntry = useCallback((accountId: number, e: Entry) => {
    store.upsertEntry(accountId, e);
    setEntriesByAccount(store.loadEntriesByAccount());
  }, []);

  const removeEntry = useCallback((accountId: number, date: string) => {
    store.deleteEntry(accountId, date);
    setEntriesByAccount(store.loadEntriesByAccount());
  }, []);

  const importJournal = useCallback((accountId: number, journal: Journal) => {
    store.importJournal(accountId, journal.entries, journal.adjustments);
    setEntriesByAccount(store.loadEntriesByAccount());
    setAdjustmentsByAccount(store.loadAdjustmentsByAccount());
  }, []);

  const setBalanceAdjustment = useCallback((accountId: number, date: string, amount: number) => {
    store.setAdjustment(accountId, date, amount);
    setAdjustmentsByAccount(store.loadAdjustmentsByAccount());
  }, []);

  const updateSettings = useCallback((s: Settings) => {
    store.saveSettings(s);
    setSettings(s);
  }, []);

  const addReminder = useCallback(async (r: Omit<Reminder, 'id' | 'notifIds'>) => {
    const inserted = store.insertReminder({ ...r, notifIds: [] });
    const notifIds = await scheduleReminderNotifs({ ...inserted, notifIds: [] });
    const full = { ...inserted, notifIds };
    store.updateReminder(full);
    setReminders(store.loadReminders());
  }, []);

  const editReminder = useCallback(async (r: Reminder) => {
    await cancelReminderNotifs(r.notifIds);
    const notifIds = await scheduleReminderNotifs(r);
    store.updateReminder({ ...r, notifIds });
    setReminders(store.loadReminders());
  }, []);

  const removeReminder = useCallback(async (id: number) => {
    const current = store.loadReminders().find((r) => r.id === id);
    if (current) await cancelReminderNotifs(current.notifIds);
    store.deleteReminder(id);
    setReminders(store.loadReminders());
  }, []);

  const addPost = useCallback((title: string, content: string, images: string[] = []) => {
    const now = new Date().toISOString();
    const post = store.insertPost({
      title,
      content,
      status: 'draft',
      images,
      createdAt: now,
      updatedAt: now,
    });
    setPosts(store.loadPosts());
    return post;
  }, []);

  const editPost = useCallback((p: Post) => {
    store.updatePost({ ...p, updatedAt: new Date().toISOString() });
    setPosts(store.loadPosts());
  }, []);

  const removePost = useCallback(async (id: number) => {
    // відв'язати і вимкнути нагадування, що вели на цей пост
    for (const r of store.loadReminders()) {
      if (r.postId === id) {
        await cancelReminderNotifs(r.notifIds);
        store.updateReminder({ ...r, postId: null, enabled: false, notifIds: [] });
      }
    }
    const post = store.loadPosts().find((p) => p.id === id);
    if (post) deleteImages(post.images);
    store.deletePost(id);
    setPosts(store.loadPosts());
    setReminders(store.loadReminders());
  }, []);

  // Після перевстановлення застосунку чи перезавантаження телефона Android сам
  // відновлює заплановані сповіщення; додатково пересинхронізуємо кастомні
  // нагадування один раз при старті — на випадок, якщо щось загубилось.
  useEffect(() => {
    if (!notifGranted) return;
    (async () => {
      for (const r of store.loadReminders()) {
        if (!r.enabled) continue;
        await cancelReminderNotifs(r.notifIds);
        const notifIds = await scheduleReminderNotifs(r);
        store.updateReminder({ ...r, notifIds });
      }
      setReminders(store.loadReminders());
    })().catch(() => {});
    // лише один раз після отримання дозволу
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifGranted]);

  const value: DataContextValue = {
    accounts,
    activeAccount,
    overview,
    entries,
    entriesByAccount,
    adjustments,
    adjustmentsByAccount,
    settings,
    reminders,
    posts,
    stats,
    notifGranted,
    today,
    setActiveAccount,
    addAccount,
    editAccount,
    removeAccount,
    saveEntry,
    removeEntry,
    importJournal,
    setBalanceAdjustment,
    updateSettings,
    addReminder,
    editReminder,
    removeReminder,
    addPost,
    editPost,
    removePost,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
