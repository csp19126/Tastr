import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { APP_NAME } from '@shared';
import { Loading, Logo } from '@/components/states';
import { Card, ListRow, Screen, T } from '@/components/ui';
import { APP_VERSION } from '@/lib/config';
import { useContent } from '@/lib/content';
import { router } from 'expo-router';
import { space } from '@/lib/theme';

/** The About screen. Every block except "House rules" is edited live from Admin → App content. */
export default function About() {
  const { t } = useTranslation();
  const content = useContent();
  if (content.isLoading) return <Loading />;
  const c = content.data?.content ?? {};
  const block = (key: 'about_intro' | 'who_runs_this_app' | 'partnerships', fallbackTitle: string, testID: string) => (
    <Card testID={testID}>
      <T v="label">{c[key]?.title ?? fallbackTitle}</T>
      <T>{c[key]?.body ?? '…'}</T>
    </Card>
  );
  return (
    <Screen scroll>
      <View style={{ alignItems: 'center', gap: space.s }}>
        <Logo size={96} />
        <T v="hero">{APP_NAME}</T>
        <T v="dim">{t('settings.version', { version: APP_VERSION })}</T>
      </View>
      {block('about_intro', t('about.title'), 'about-intro')}
      <Card>
        <T v="label">{t('about.rules')}</T>
        <T>{t('about.rulesBody')}</T>
      </Card>
      {block('who_runs_this_app', t('about.whoRuns'), 'about-who-runs')}
      {block('partnerships', t('about.partnerships'), 'about-partnerships')}
      <View>
        <ListRow title={t('settings.terms')} onPress={() => router.push('/legal/terms')} />
        <ListRow title={t('settings.privacy')} onPress={() => router.push('/legal/privacy')} />
      </View>
    </Screen>
  );
}
