import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorText } from '@/components/errors';
import { EmptyState, Loading } from '@/components/mascot';
import { Button, Card, Field, Row, Screen, T } from '@/components/ui';
import { get, mediaUri, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { listName } from '@/lib/lists';
import { radius, space, useColors } from '@/lib/theme';
import type { List } from '@/lib/types';

export default function ListsTab() {
  const { t } = useTranslation();
  const c = useColors();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const lists = useQuery({ queryKey: ['lists'], queryFn: () => get<{ lists: List[] }>('/lists'), enabled: !!user });
  const create = useMutation({
    mutationFn: () => post<List>('/lists', { name: name.trim() }),
    onSuccess: () => {
      setName('');
      qc.invalidateQueries({ queryKey: ['lists'] });
    },
  });

  if (!user) {
    return (
      <Screen>
        <EmptyState mood="happy" title={t('lists.signInTitle')} body={t('lists.emptyBody')} action={<Button title={t('common.signIn')} onPress={() => router.push('/sign-in')} />} />
      </Screen>
    );
  }
  if (lists.isLoading) return <Loading />;

  const all = lists.data?.lists ?? [];
  const empty = all.every((l) => l.placeCount === 0);

  return (
    <Screen scroll>
      {lists.isError ? <T v="error">{errorText(lists.error)}</T> : null}
      {all.map((l) => (
        <Card key={l.id} testID={`list-${l.id}`} onPress={() => router.push(`/list/${l.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
          <View style={{ width: 56, height: 56, borderRadius: radius.m, backgroundColor: c.cardAlt, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
            {l.coverUrl ? <Image source={{ uri: mediaUri(l.coverUrl) }} style={{ width: '100%', height: '100%' }} /> : <T style={{ fontSize: 24 }}>{l.kind === 'date_night' ? '🕯️' : l.kind === 'want_to_try' ? '🤤' : '🔖'}</T>}
          </View>
          <View style={{ flex: 1 }}>
            <T v="bold">{listName(l)}</T>
            <T v="dim">{t('lists.places', { count: l.placeCount })}{l.isShared ? ' · 🔗' : ''}</T>
          </View>
          <T v="dim">›</T>
        </Card>
      ))}
      {empty ? <EmptyState mood="sniff" title={t('lists.emptyTitle')} body={t('lists.emptyBody')} /> : null}
      <Row style={{ alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <Field testID="new-list-name" label={t('lists.newList')} placeholder={t('lists.newListPlaceholder')} value={name} onChangeText={setName} maxLength={60} />
        </View>
        <Button testID="create-list" title="+" disabled={!name.trim()} loading={create.isPending} onPress={() => create.mutate()} />
      </Row>
      {create.error ? <T v="error">{errorText(create.error)}</T> : null}
    </Screen>
  );
}
