import { Tabs } from 'expo-router/js-tabs';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/lib/theme';

const icon = (emoji: string) =>
  function TabIcon({ focused }: { focused: boolean }) {
    return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.55 }}>{emoji}</Text>;
  };

export default function TabsLayout() {
  const { t } = useTranslation();
  const c = useColors();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textDim,
        tabBarStyle: { backgroundColor: c.card, borderTopColor: c.line },
        headerStyle: { backgroundColor: c.bg },
        headerTintColor: c.text,
        headerTitleStyle: { fontWeight: '800' },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: c.bg },
      }}>
      <Tabs.Screen name="index" options={{ title: t('tabs.discover'), headerShown: false, tabBarIcon: icon('🔍'), tabBarButtonTestID: 'tab-discover' }} />
      <Tabs.Screen name="feed" options={{ title: t('tabs.feed'), tabBarIcon: icon('📰'), tabBarButtonTestID: 'tab-feed' }} />
      <Tabs.Screen name="add" options={{ title: t('tabs.add'), tabBarIcon: icon('📸'), tabBarButtonTestID: 'tab-add' }} />
      <Tabs.Screen name="lists" options={{ title: t('tabs.lists'), tabBarIcon: icon('🔖'), tabBarButtonTestID: 'tab-lists' }} />
      <Tabs.Screen name="me" options={{ title: t('tabs.me'), tabBarIcon: icon('👤'), tabBarButtonTestID: 'tab-me' }} />
    </Tabs>
  );
}
