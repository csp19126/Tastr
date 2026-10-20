import '@/lib/i18n';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AuthProvider, useAuth } from '@/lib/auth';
import { FiltersProvider } from '@/lib/filters';
import { useColors } from '@/lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function AppStack() {
  const { ready } = useAuth();
  const { t } = useTranslation();
  const c = useColors();
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  if (!ready) return null;
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: c.bg },
        headerTintColor: c.text,
        headerTitleStyle: { fontWeight: '800' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: c.bg },
        headerBackButtonDisplayMode: 'minimal',
      }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="sign-in" options={{ presentation: 'modal', title: t('common.signIn') }} />
      <Stack.Screen name="forgot-password" options={{ presentation: 'modal', title: t('reset.title') }} />
      <Stack.Screen name="filters" options={{ presentation: 'modal', title: t('discover.filters') }} />
      <Stack.Screen name="save-to-list" options={{ presentation: 'modal', title: t('lists.saveTo') }} />
      <Stack.Screen name="report" options={{ presentation: 'modal', title: t('report.title') }} />
      <Stack.Screen name="place/[id]" options={{ title: '' }} />
      <Stack.Screen name="place/new" options={{ title: t('addPlace.title') }} />
      <Stack.Screen name="review/compose" options={{ title: t('review.newTitle') }} />
      <Stack.Screen name="review/[id]" options={{ title: '' }} />
      <Stack.Screen name="user/[id]" options={{ title: '' }} />
      <Stack.Screen name="list/[id]" options={{ title: '' }} />
      <Stack.Screen name="shared/[slug]" options={{ title: '' }} />
      <Stack.Screen name="settings" options={{ title: t('settings.title') }} />
      <Stack.Screen name="edit-profile" options={{ title: t('profile.editProfile') }} />
      <Stack.Screen name="about" options={{ title: t('about.title') }} />
      <Stack.Screen name="legal/[key]" options={{ title: '' }} />
      <Stack.Screen name="admin/index" options={{ title: t('admin.title') }} />
      <Stack.Screen name="admin/content" options={{ title: t('admin.content') }} />
    </Stack>
  );
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthProvider>
          <FiltersProvider>
            <StatusBar style="auto" />
            <AppStack />
          </FiltersProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
