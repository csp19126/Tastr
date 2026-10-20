import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, Platform, Share, Switch } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PlaceCard } from '@/components/cards';
import { errorText } from '@/components/errors';
import { EmptyState, Loading } from '@/components/mascot';
import { Button, Card, Row, Screen, T } from '@/components/ui';
import { del, get, patch } from '@/lib/api';
import { listName } from '@/lib/lists';
import { useColors } from '@/lib/theme';
import type { ListDetail } from '@/lib/types';

export default function ListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const c = useColors();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['list', id], queryFn: () => get<ListDetail>(`/lists/${id}`) });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['list', id] });
    qc.invalidateQueries({ queryKey: ['lists'] });
  };
  const share = useMutation({ mutationFn: (on: boolean) => patch(`/lists/${id}`, { isShared: on }), onSuccess: refresh });

  if (list.isLoading) return <Loading />;
  if (!list.data) return <EmptyState title={errorText(list.error)} />;
  const l = list.data;
  const name = listName(l);

  async function removePlace(placeId: number) {
    await del(`/lists/${id}/places/${placeId}`);
    refresh();
  }

  async function deleteList() {
    const go = async () => {
      await del(`/lists/${id}`);
      qc.invalidateQueries({ queryKey: ['lists'] });
      router.back();
    };
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(t('lists.deleteConfirm'))) await go();
    } else {
      Alert.alert(t('common.delete'), t('lists.deleteConfirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: go },
      ]);
    }
  }

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: name }} />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="bold" style={{ flex: 1 }}>{l.isShared ? `🔗 ${t('lists.shareOn')}` : `🔒 ${t('lists.shareOff')}`}</T>
          <Switch testID="share-switch" value={l.isShared} onValueChange={(v) => share.mutate(v)} trackColor={{ true: c.primary }} />
        </Row>
        {l.isShared && l.shareUrl ? (
          <Button small icon="↗️" title={t('lists.shareLink')} onPress={() => Share.share({ message: t('lists.shareMessage', { name, url: l.shareUrl }) })} />
        ) : null}
      </Card>
      {l.places.length === 0 ? <EmptyState mood="sniff" title={t('lists.emptyTitle')} body={t('lists.emptyBody')} /> : null}
      {l.places.map((p) => (
        <Card key={p.id} style={{ padding: 0, borderWidth: 0, backgroundColor: 'transparent' }}>
          <PlaceCard place={p} />
          {p.note ? <T v="dim">📝 {p.note}</T> : null}
          <Button small kind="ghost" title={t('lists.remove')} onPress={() => removePlace(p.id)} />
        </Card>
      ))}
      {l.kind === 'custom' ? <Button kind="ghost" title={t('common.delete')} onPress={deleteList} /> : null}
    </Screen>
  );
}
