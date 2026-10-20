import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { APP_NAME, CATEGORIES } from '@shared';
import { categoryIcon, PlaceCard } from '@/components/cards';
import { errorText } from '@/components/errors';
import { EmptyState, Loading } from '@/components/mascot';
import { PlacesMap } from '@/components/places-map';
import { Button, Chip, ChipRow, Row, T } from '@/components/ui';
import { get } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { activeFilterCount, DEFAULT_FILTERS, useFilters } from '@/lib/filters';
import { cityName } from '@/lib/format';
import { useMyLocation } from '@/lib/location';
import { font, radius, space, useColors } from '@/lib/theme';
import type { PlaceCard as Place } from '@/lib/types';

export default function Discover() {
  const { t } = useTranslation();
  const c = useColors();
  const { user } = useAuth();
  const { filters, setFilters } = useFilters();
  const [mode, setMode] = useState<'list' | 'map'>('list');
  const [typed, setTyped] = useState(filters.q);
  const home = user?.homeCity ?? 'da_nang';
  const loc = useMyLocation(home);

  // Search as you type, but wait for a pause so we don't fire on every letter.
  useEffect(() => {
    const id = setTimeout(() => {
      if (typed !== filters.q) setFilters({ ...filters, q: typed });
    }, 350);
    return () => clearTimeout(id);
  }, [typed]); // eslint-disable-line react-hooks/exhaustive-deps

  const point = loc.point;
  // A search goes wider than browsing: people search for a dish across the whole city.
  const radiusKm = filters.q ? Math.max(filters.radiusKm, 50) : filters.radiusKm;
  const query = useQuery({
    queryKey: ['places', filters, point.lat.toFixed(3), point.lng.toFixed(3), radiusKm],
    queryFn: () =>
      get<{ places: Place[] }>('/places', {
        lat: point.lat,
        lng: point.lng,
        radiusKm,
        q: filters.q,
        category: filters.categories,
        price: filters.price,
        tags: filters.tags,
        minPaws: filters.minPaws ?? undefined,
        openNow: filters.openNow || undefined,
        sort: filters.sort,
        limit: 60,
      }),
  });
  const places = query.data?.places ?? [];
  const filterCount = activeFilterCount(filters);

  const toggleCategory = (cat: (typeof CATEGORIES)[number]) =>
    setFilters({
      ...filters,
      categories: filters.categories.includes(cat) ? filters.categories.filter((x) => x !== cat) : [...filters.categories, cat],
    });

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingHorizontal: space.l, paddingTop: space.s, gap: space.m }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="hero">{APP_NAME}</T>
          <Row gap={space.xs} style={{ backgroundColor: c.cardAlt, borderRadius: radius.pill, padding: 3 }}>
            {(['list', 'map'] as const).map((m) => (
              <Pressable
                key={m}
                testID={`mode-${m}`}
                onPress={() => setMode(m)}
                style={{ paddingVertical: 6, paddingHorizontal: space.m, borderRadius: radius.pill, backgroundColor: mode === m ? c.card : 'transparent' }}>
                <T v="small" style={{ fontWeight: '700' }}>{m === 'list' ? t('discover.list') : t('discover.map')}</T>
              </Pressable>
            ))}
          </Row>
        </Row>
        <Row>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: radius.pill, borderWidth: 1, borderColor: c.line, paddingHorizontal: space.m }}>
            <T>🔍</T>
            <TextInput
              testID="search"
              value={typed}
              onChangeText={setTyped}
              placeholder={t('discover.searchPlaceholder')}
              placeholderTextColor={c.textDim}
              returnKeyType="search"
              autoCorrect={false}
              style={{ flex: 1, paddingVertical: space.m, paddingHorizontal: space.s, color: c.text, fontSize: font.body }}
            />
            {typed ? (
              <Pressable onPress={() => setTyped('')} hitSlop={8}>
                <T v="dim">✕</T>
              </Pressable>
            ) : null}
          </View>
          <Button testID="open-filters" kind="secondary" small title={filterCount ? `${t('discover.filters')} · ${filterCount}` : t('discover.filters')} onPress={() => router.push('/filters')} />
        </Row>
        <ChipRow scroll>
          <Chip label={t('discover.openNow')} icon="🕒" selected={filters.openNow} onPress={() => setFilters({ ...filters, openNow: !filters.openNow })} />
          {CATEGORIES.map((cat) => (
            <Chip key={cat} testID={`cat-${cat}`} label={t(`categories.${cat}`)} icon={categoryIcon(cat)} selected={filters.categories.includes(cat)} onPress={() => toggleCategory(cat)} />
          ))}
        </ChipRow>
        {loc.status === 'denied' ? <T v="dim">📍 {t('discover.locationOff', { city: cityName(home) })}</T> : null}
      </View>

      {mode === 'map' ? (
        <View style={{ flex: 1, marginTop: space.m }}>
          <PlacesMap places={places} centre={point} showsUser={loc.isReal} />
        </View>
      ) : query.isLoading ? (
        <Loading />
      ) : query.isError ? (
        <EmptyState mood="sleep" title={errorText(query.error)} action={<Button title={t('common.retry')} onPress={() => query.refetch()} />} />
      ) : (
        <FlatList
          data={places}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={{ padding: space.l, gap: space.m, paddingBottom: space.xxl * 2 }}
          refreshing={query.isRefetching}
          onRefresh={() => query.refetch()}
          ListHeaderComponent={places.length ? <T v="dim">{t('discover.resultCount', { count: places.length })}</T> : undefined}
          renderItem={({ item }) => <PlaceCard place={item} />}
          ListEmptyComponent={
            <EmptyState
              mood="sniff"
              title={t('discover.emptyTitle')}
              body={t('discover.emptyBody')}
              action={
                <View style={{ gap: space.s, alignItems: 'center' }}>
                  {filterCount || filters.q ? (
                    <Button kind="secondary" title={t('discover.clearFilters')} onPress={() => { setTyped(''); setFilters(DEFAULT_FILTERS); }} />
                  ) : null}
                  <Button title={t('discover.addPlace')} icon="📍" onPress={() => router.push('/place/new')} />
                </View>
              }
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
