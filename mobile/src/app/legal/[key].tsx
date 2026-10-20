import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Loading } from '@/components/mascot';
import { Screen, T } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useContent } from '@/lib/content';

/** Terms of Use and Privacy Policy, kept on the server so they can change without an app release. */
export default function Legal() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const { t } = useTranslation();
  const content = useContent();
  const which = key === 'privacy' ? 'privacy' : 'terms';
  if (content.isLoading) return <Loading />;
  const entry = content.data?.content[which];
  const title = entry?.title ?? (which === 'privacy' ? t('settings.privacy') : t('settings.terms'));
  return (
    <Screen scroll>
      <Stack.Screen options={{ title }} />
      <T v="title">{title}</T>
      {entry ? <T v="dim">{formatDate(entry.updatedAt)}</T> : null}
      <T>{entry?.body ?? t('errors.network')}</T>
    </Screen>
  );
}
