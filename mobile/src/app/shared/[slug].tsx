import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { PlaceCard } from '@/components/cards';
import { errorText } from '@/components/errors';
import { EmptyState, Loading } from '@/components/states';
import { Screen, T } from '@/components/ui';
import { get } from '@/lib/api';
import { listName } from '@/lib/lists';
import type { ListDetail } from '@/lib/types';

/** Someone's shared list, opened from a link (tastr://shared/…). */
export default function SharedList() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t } = useTranslation();
  const list = useQuery({ queryKey: ['shared-list', slug], queryFn: () => get<ListDetail>(`/shared-lists/${slug}`) });
  if (list.isLoading) return <Loading />;
  if (!list.data) return <EmptyState title={errorText(list.error)} />;
  const l = list.data;
  return (
    <Screen scroll>
      <Stack.Screen options={{ title: listName(l) }} />
      <T v="title">{listName(l)}</T>
      {l.owner ? <T v="dim">{t('lists.by', { name: l.owner.displayName })} · {t('lists.places', { count: l.places.length })}</T> : null}
      {l.places.map((p) => (
        <PlaceCard key={p.id} place={p} />
      ))}
    </Screen>
  );
}
