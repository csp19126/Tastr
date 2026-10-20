import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CURRENCIES } from '@shared';
import { errorText } from '@/components/errors';
import { Button, Chip, ChipRow, Divider, ListRow, Row, Screen, Section, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { APP_VERSION } from '@/lib/config';
import { useColors } from '@/lib/theme';
import type { Me } from '@/lib/types';

export default function Settings() {
  const { t, i18n } = useTranslation();
  const c = useColors();
  const auth = useAuth();
  const { user } = auth;
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<void>) => fn().catch((e) => setError(errorText(e)));

  function notify(key: keyof Me['notifications'], label: string) {
    if (!user) return null;
    return (
      <Row style={{ justifyContent: 'space-between' }}>
        <T style={{ flex: 1 }}>{label}</T>
        <Switch value={user.notifications[key]} onValueChange={(v) => run(() => auth.updateMe({ notifications: { [key]: v } }))} trackColor={{ true: c.primary }} />
      </Row>
    );
  }

  function confirmDelete() {
    const go = () =>
      run(async () => {
        await auth.deleteAccount();
        router.replace('/');
        Alert.alert('', t('settings.deleted'));
      });
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(`${t('settings.deleteTitle')}\n${t('settings.deleteBody')}`)) go();
      return;
    }
    Alert.alert(t('settings.deleteTitle'), t('settings.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.deleteConfirm'), style: 'destructive', onPress: go },
    ]);
  }

  return (
    <Screen scroll>
      <Section title={t('settings.language')}>
        <ChipRow>
          <Chip testID="lang-en" label="English" selected={i18n.language === 'en'} onPress={() => run(() => auth.setLanguage('en'))} />
          <Chip testID="lang-vi" label="Tiếng Việt" selected={i18n.language === 'vi'} onPress={() => run(() => auth.setLanguage('vi'))} />
        </ChipRow>
      </Section>

      {user ? (
        <>
          <Section title={t('settings.currency')}>
            <ChipRow>
              {CURRENCIES.map((cur) => (
                <Chip key={cur} label={cur} selected={user.currency === cur} onPress={() => run(() => auth.updateMe({ currency: cur }))} />
              ))}
            </ChipRow>
          </Section>
          <Section title={t('settings.notifications')}>
            {notify('follows', t('settings.notifyFollows'))}
            {notify('comments', t('settings.notifyComments'))}
            {notify('helpful', t('settings.notifyHelpful'))}
          </Section>
        </>
      ) : null}

      {error ? <T v="error">{error}</T> : null}

      <View>
        <ListRow title={`🐶 ${t('settings.about')}`} onPress={() => router.push('/about')} />
        <Divider />
        <ListRow title={t('settings.terms')} onPress={() => router.push('/legal/terms')} />
        <Divider />
        <ListRow title={t('settings.privacy')} onPress={() => router.push('/legal/privacy')} />
        {user?.role === 'admin' ? (
          <>
            <Divider />
            <ListRow testID="open-admin" title={`🛡️ ${t('settings.admin')}`} onPress={() => router.push('/admin')} />
          </>
        ) : null}
      </View>

      {user ? (
        <View style={{ gap: 8 }}>
          <Button kind="secondary" title={t('auth.signOut')} onPress={() => run(async () => { await auth.signOut(); router.replace('/'); })} />
          <Button testID="delete-account" kind="ghost" title={t('settings.deleteAccount')} onPress={confirmDelete} />
        </View>
      ) : (
        <Button title={t('common.signIn')} onPress={() => router.push('/sign-in')} />
      )}
      <T v="dim" style={{ textAlign: 'center' }}>{t('settings.version', { version: APP_VERSION })}</T>
    </Screen>
  );
}
