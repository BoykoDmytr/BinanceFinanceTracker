export interface Entry {
  /** YYYY-MM-DD */
  date: string;
  volume: number;
  fee: number;
  pointsPlus: number;
  pointsMinus: number;
  dropIncome: number;
  gasExpense: number;
  comment: string;
}

export interface Settings {
  startBalance: number;
  startPoints: number;
  defaultPoints: number;
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
  createdAt: string;
  updatedAt: string;
}
