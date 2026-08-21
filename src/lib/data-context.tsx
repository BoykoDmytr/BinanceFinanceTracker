import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { computeStats, type Stats } from './calc';
import * as store from './db';
import {
  cancelReminderNotifs,
  planSpinReminders,
  scheduleReminderNotifs,
  setupNotifications,
} from './notifications';
import type { Entry, Post, Reminder, Settings } from './types';

interface DataContextValue {
  entries: Entry[];
  settings: Settings;
  reminders: Reminder[];
  posts: Post[];
  stats: Stats;
  notifGranted: boolean;

  saveEntry: (e: Entry) => void;
  removeEntry: (date: string) => void;
  updateSettings: (s: Settings) => void;

  addReminder: (r: Omit<Reminder, 'id' | 'notifIds'>) => Promise<void>;
  editReminder: (r: Reminder) => Promise<void>;
  removeReminder: (id: number) => Promise<void>;

  addPost: (title: string, content: string) => Post;
  editPost: (p: Post) => void;
  removePost: (id: number) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  // ініціалізація синхронна: SQLite відкривається і сідиться до першого рендера
  const [entries, setEntries] = useState<Entry[]>(() => {
    store.initDb();
    return store.loadEntries();
  });
  const [settings, setSettings] = useState<Settings>(() => store.loadSettings());
  const [reminders, setReminders] = useState<Reminder[]>(() => store.loadReminders());
  const [posts, setPosts] = useState<Post[]>(() => store.loadPosts());
  const [notifGranted, setNotifGranted] = useState(false);
  const grantedRef = useRef(false);

  const stats = useMemo(() => computeStats(entries, settings), [entries, settings]);

  useEffect(() => {
    (async () => {
      const granted = await setupNotifications();
      grantedRef.current = granted;
      setNotifGranted(granted);
    })();
  }, []);

  // Перепланувати «прокрут»-нагадування при зміні журналу чи налаштувань
  useEffect(() => {
    if (!notifGranted) return;
    planSpinReminders(entries, settings).catch(() => {});
  }, [entries, settings, notifGranted]);

  const saveEntry = useCallback((e: Entry) => {
    store.upsertEntry(e);
    setEntries(store.loadEntries());
  }, []);

  const removeEntry = useCallback((date: string) => {
    store.deleteEntry(date);
    setEntries(store.loadEntries());
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

  const addPost = useCallback((title: string, content: string) => {
    const now = new Date().toISOString();
    const post = store.insertPost({
      title,
      content,
      status: 'draft',
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
    entries,
    settings,
    reminders,
    posts,
    stats,
    notifGranted,
    saveEntry,
    removeEntry,
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
