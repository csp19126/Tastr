import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorText } from '@/components/errors';
import { Loading } from '@/components/mascot';
import { Button, Field, ListRow, Row, Screen, T } from '@/components/ui';
import { del, get, post } from '@/lib/api';
import { listName } from '@/lib/lists';
import type { List, PlaceDetail } from '@/lib/types';

/** Tick the lists this place belongs in. Changes save straight away. */
export default function SaveToList() {
  const { placeId } = useLocalSearchParams<{ placeId: string }>();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const lists = useQuery({ queryKey: ['lists'], queryFn: () => get<{ lists: List[] }>('/lists') });
  const place = useQuery({ queryKey: ['place', placeId], queryFn: () => get<PlaceDetail>(`/places/${placeId}`) });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['place', placeId] });
    qc.invalidateQueries({ queryKey: ['lists'] });
    qc.invalidateQueries({ queryKey: ['list'] });
  };
  const toggle = useMutation({
    mutationFn: ({ listId, on }: { listId: number; on: boolean }) =>
      on ? post(`/lists/${listId}/places`, { placeId: Number(placeId) }) : del(`/lists/${listId}/places/${placeId}`),
    onSuccess: refresh,
  });
  const create = useMutation({
    mutationFn: async () => {
      const l = await post<List>('/lists', { name: name.trim() });
      await post(`/lists/${l.id}/places`, { placeId: Number(placeId) });
    },
    onSuccess: () => {
      setName('');
      refresh();
    },
  });

  if (lists.isLoading || place.isLoading) return <Loading />;
  const savedIn = new Set(place.data?.savedInLists ?? []);

  return (
    <Screen scroll>
      <T v="title">{place.data?.name}</T>
      <View>
        {(lists.data?.lists ?? []).map((l) => {
          const on = savedIn.has(l.id);
          return (
            <ListRow
              key={l.id}
              testID={`toggle-list-${l.kind}`}
              title={listName(l)}
              subtitle={t('lists.places', { count: l.placeCount })}
              onPress={() => toggle.mutate({ listId: l.id, on: !on })}
              right={<T style={{ fontSize: 22 }}>{on ? '✅' : '⬜'}</T>}
            />
          );
        })}
      </View>
      <Row style={{ alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <Field label={t('lists.newList')} placeholder={t('lists.newListPlaceholder')} value={name} onChangeText={setName} maxLength={60} />
        </View>
        <Button title="+" disabled={!name.trim()} loading={create.isPending} onPress={() => create.mutate()} />
      </Row>
      {toggle.error || create.error ? <T v="error">{errorText(toggle.error ?? create.error)}</T> : null}
      <Button title={t('common.done')} onPress={() => router.back()} />
    </Screen>
  );
}
