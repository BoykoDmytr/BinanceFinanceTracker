export interface Entry {
  /** YYYY-MM-DD */
  date: string;
  volume: number;
  fee: number;
  pointsPlus: number;
  pointsMinus: number;
  dropIncome: number;
  boosterIncome: number;
  gasExpense: number;
  comment: string;
}

/** Стартові значення, від яких рахуються баланс і бали акаунта. */
export interface AccountParams {
  startBalance: number;
  startPoints: number;
  defaultPoints: number;
}

export interface Account extends AccountParams {
  id: number;
  /** довільна назва: «Samsung A54», «телефон мами» тощо */
  name: string;
  /** враховувати акаунт у щоденному нагадуванні «прокрут» */
  spinReminder: boolean;
}

/** Журнал усіх акаунтів: id акаунта → записи. */
export type EntriesByAccount = Record<number, Entry[]>;

/**
 * Корекція балансу за день: депозит, вивід, зміна курсу — усе, чого немає в
 * журналі. Одна на акаунт і дату; входить у баланс, але не в P&L операцій.
 */
export interface BalanceAdjustment {
  /** YYYY-MM-DD */
  date: string;
  amount: number;
}

/** Корекції всіх акаунтів: id акаунта → корекції (за датою). */
export type AdjustmentsByAccount = Record<number, BalanceAdjustment[]>;

/** Журнал акаунта разом з корекціями балансу — те, що йде в CSV. */
export interface Journal {
  entries: Entry[];
  adjustments: BalanceAdjustment[];
}

/** Глобальні налаштування (спільні для всіх акаунтів). */
export interface Settings {
  spinReminderEnabled: boolean;
  /** HH:MM */
  spinReminderTime: string;
  /** повторне нагадування через 2 години, якщо запису досі немає */
  spinReminderRepeat: boolean;
}

export type ReminderKind = 'daily' | 'weekly' | 'once';

export interface Reminder {
  id: number;
  title: string;
  body: string;
  kind: ReminderKind;
  /** HH:MM */
  time: string;
  /** 1=Пн … 7=Нд, лише для kind='weekly' */
  weekdays: number[];
  /** YYYY-MM-DD, лише для kind='once' */
  date: string;
  enabled: boolean;
  postId: number | null;
  notifIds: string[];
}

export type PostStatus = 'draft' | 'published';

export interface Post {
  id: number;
  title: string;
  content: string;
  status: PostStatus;
  /** локальні URI прикріплених картинок */
  images: string[];
  createdAt: string;
  updatedAt: string;
}
