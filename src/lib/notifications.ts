import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { accountsMissing } from './calc';
import { addDays, parseDate, todayISO } from './format';
import type { Account, EntriesByAccount, Reminder, Settings } from './types';

const SPIN_PREFIX = 'spin-';
const SPIN_DAYS_AHEAD = 30;
export const CHANNEL_ID = 'reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function setupNotifications(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Нагадування',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F0B90B',
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

function parseTime(hhmm: string): { hour: number; minute: number } {
  const [h, m] = hhmm.split(':').map(Number);
  return {
    hour: Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 20,
    minute: Number.isFinite(m) ? Math.min(59, Math.max(0, m)) : 0,
  };
}

function dateAt(iso: string, hhmm: string): Date {
  const { hour, minute } = parseTime(hhmm);
  const d = parseDate(iso);
  d.setHours(hour, minute, 0, 0);
  return d;
}

// Лічильник поколінь: якщо під час await почалось нове планування,
// старе перериває себе — інакше два паралельні запуски лишать дублікати.
let planGeneration = 0;

/**
 * Планує нагадування «прокрут» на 30 днів наперед, пропускаючи дні, за які
 * всі акаунти з увімкненим нагадуванням уже мають запис. Викликається при
 * кожному старті застосунку та після кожного збереження запису — тому
 * «наперед» тут лише страховка на випадок, якщо застосунок довго не відкривали.
 */
export async function planSpinReminders(
  accounts: Account[],
  entriesByAccount: EntriesByAccount,
  settings: Settings
): Promise<void> {
  const gen = ++planGeneration;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  if (gen !== planGeneration) return;
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(SPIN_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
  if (gen !== planGeneration) return;

  const tracked = accounts.filter((a) => a.spinReminder);
  if (!settings.spinReminderEnabled || tracked.length === 0) return;

  const now = new Date();
  const today = todayISO();

  for (let i = 0; i < SPIN_DAYS_AHEAD; i++) {
    if (gen !== planGeneration) return;
    const iso = i === 0 ? today : addDays(today, i);
    const missing = accountsMissing(tracked, entriesByAccount, iso);
    if (missing.length === 0) continue;

    // з одним акаунтом тексти як раніше; з кількома — кажемо, які саме не записані
    const who = tracked.length > 1 ? `Не записано: ${missing.map((a) => a.name).join(', ')}.` : null;
    // тап відкриває журнал першого незаписаного акаунта
    const data = { url: '/journal', accountId: missing[0].id };

    const first = dateAt(iso, settings.spinReminderTime);
    if (first.getTime() > now.getTime()) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${SPIN_PREFIX}${iso}`,
        content: {
          title: 'Час крутити! 🔄',
          body: who ?? 'За сьогодні ще немає запису. Зроби прокрут і занеси його в журнал.',
          sound: true,
          data,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: first,
          channelId: CHANNEL_ID,
        },
      });
    }

    if (settings.spinReminderRepeat) {
      const second = new Date(dateAt(iso, settings.spinReminderTime).getTime() + 2 * 60 * 60 * 1000);
      if (second.getDate() === first.getDate() && second.getTime() > now.getTime()) {
        await Notifications.scheduleNotificationAsync({
          identifier: `${SPIN_PREFIX}2-${iso}`,
          content: {
            title: '😤 Прокрут досі не записано',
            body: who
              ? `Стрік під загрозою! ${who}`
              : 'Стрік під загрозою! Крутни або запиши день, поки він не згорів.',
            sound: true,
            data,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: second,
            channelId: CHANNEL_ID,
          },
        });
      }
    }
  }
}

/** Скасовує заплановані сповіщення кастомного нагадування. */
export async function cancelReminderNotifs(notifIds: string[]): Promise<void> {
  await Promise.all(notifIds.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
}

/**
 * Планує сповіщення для кастомного нагадування. Повертає список
 * ідентифікаторів — їх треба зберегти, щоб потім скасувати.
 */
export async function scheduleReminderNotifs(r: Reminder): Promise<string[]> {
  if (!r.enabled) return [];
  const { hour, minute } = parseTime(r.time);
  const content: Notifications.NotificationContentInput = {
    title: `🔔 ${r.title}`,
    body: r.body || (r.postId ? 'Час запостити заготовку — відкрий її в застосунку.' : ''),
    sound: true,
    data: { url: r.postId ? `/post/${r.postId}` : '/reminders' },
  };

  const ids: string[] = [];
  if (r.kind === 'daily') {
    ids.push(
      await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
          channelId: CHANNEL_ID,
        },
      })
    );
  } else if (r.kind === 'weekly') {
    for (const wd of r.weekdays) {
      // у нас 1=Пн … 7=Нд, в expo-notifications 1=Нд … 7=Сб
      const expoWeekday = (wd % 7) + 1;
      ids.push(
        await Notifications.scheduleNotificationAsync({
          content,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: expoWeekday,
            hour,
            minute,
            channelId: CHANNEL_ID,
          },
        })
      );
    }
  } else {
    const when = dateAt(r.date, r.time);
    if (when.getTime() > Date.now()) {
      ids.push(
        await Notifications.scheduleNotificationAsync({
          content,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: when,
            channelId: CHANNEL_ID,
          },
        })
      );
    }
  }
  return ids;
}
