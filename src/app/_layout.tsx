import * as Notifications from 'expo-notifications';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';

import { DataProvider, useData } from '../lib/data-context';
import { colors } from '../lib/theme';

/** Тап по сповіщенню веде на відповідний екран (журнал / пост) і акаунт. */
function NotificationLinker() {
  const { accounts, setActiveAccount } = useData();
  const lastResponse = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const data = lastResponse?.notification.request.content.data;
    const url = data?.url;
    if (typeof url === 'string') {
      // нагадування «прокрут» відкриває журнал того акаунта, який ще не записано
      // Number(): на Android дані сповіщення проходять через нативну серіалізацію
      const accountId = Number(data?.accountId);
      if (accounts.some((a) => a.id === accountId)) {
        setActiveAccount(accountId);
      }
      // даємо роутеру змонтуватись
      setTimeout(() => router.push(url as never), 100);
      // скидаємо відповідь: повторний тап по щоденному/щотижневому нагадуванню
      // приходить з тим самим identifier і без скидання ефект не спрацює вдруге
      Notifications.clearLastNotificationResponseAsync().catch(() => {});
    }
    // реагуємо лише на нове сповіщення, а не на зміну списку акаунтів
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastResponse]);
  return null;
}

export default function RootLayout() {
  return (
    <DataProvider>
      <NotificationLinker />
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="entry/[date]" options={{ presentation: 'modal', title: 'Запис дня' }} />
        <Stack.Screen name="post/[id]" options={{ presentation: 'modal', title: 'Пост' }} />
        <Stack.Screen
          name="reminder/[id]"
          options={{ presentation: 'modal', title: 'Нагадування' }}
        />
        <Stack.Screen name="account/[id]" options={{ presentation: 'modal', title: 'Акаунт' }} />
      </Stack>
    </DataProvider>
  );
}
