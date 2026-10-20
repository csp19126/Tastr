import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/mascot';
import { Button, Card, Row, Screen, Section, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { deleteDraft, listDrafts, type Draft } from '@/lib/drafts';
import { formatDate } from '@/lib/format';
import { space } from '@/lib/theme';

/** Start a review, or pick up a draft where you left off. */
export default function AddTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [drafts, setDrafts] = useState<Draft[]>([]);

  useFocusEffect(
    useCallback(() => {
      listDrafts().then(setDrafts);
    }, []),
  );

  if (!user) {
    return (
      <Screen>
        <EmptyState mood="happy" title={t('auth.needAccountTitle')} body={t('auth.needAccountBody')} action={<Button title={t('common.signIn')} onPress={() => router.push('/sign-in')} />} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <EmptyState
        mood="happy"
        title={t('review.startTitle')}
        body={t('review.startBody')}
        action={
          <View style={{ gap: space.s, alignItems: 'center' }}>
            <Button testID="start-review" icon="📸" title={t('review.start')} onPress={() => router.push('/review/compose')} />
            <Button kind="ghost" icon="📍" title={t('discover.addPlace')} onPress={() => router.push('/place/new')} />
          </View>
        }
      />
      <Section title={t('review.drafts')}>
        {drafts.length === 0 ? <T v="dim">{t('review.noDrafts')}</T> : null}
        {drafts.map((d) => (
          <Card key={d.id}>
            <T v="bold">{d.place?.name || '…'}</T>
            <T v="dim" numberOfLines={2}>{d.body || ' '}</T>
            <T v="dim">{formatDate(new Date(d.updatedAt).toISOString())} · 📷 {d.photos.length}</T>
            <Row>
              <Button small title={t('review.resume')} onPress={() => router.push({ pathname: '/review/compose', params: { draftId: d.id } })} />
              <Button small kind="ghost" title={t('review.discardDraft')} onPress={async () => { await deleteDraft(d.id); setDrafts(await listDrafts()); }} />
            </Row>
          </Card>
        ))}
      </Section>
    </Screen>
  );
}
