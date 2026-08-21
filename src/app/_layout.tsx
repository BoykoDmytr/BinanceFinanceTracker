import * as Notifications from 'expo-notifications';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';

import { DataProvider } from '../lib/data-context';
import { colors } from '../lib/theme';

export default function RootLayout() {
  // Тап по сповіщенню веде на відповідний екран (журнал / пост)
  const lastResponse = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const url = lastResponse?.notification.request.content.data?.url;
    if (typeof url === 'string') {
      // даємо роутеру змонтуватись
      setTimeout(() => router.push(url as never), 100);
      // скидаємо відповідь: повторний тап по щоденному/щотижневому нагадуванню
      // приходить з тим самим identifier і без скидання ефект не спрацює вдруге
      Notifications.clearLastNotificationResponseAsync().catch(() => {});
    }
  }, [lastResponse]);

  return (
    <DataProvider>
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
      </Stack>
    </DataProvider>
  );
}
