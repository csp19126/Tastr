import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, ScrollView, Share, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { categoryIcon, OpenBadge, ReviewCard } from '@/components/cards';
import { errorText } from '@/components/errors';
import { HoursTable } from '@/components/hours';
import { EmptyState, Loading } from '@/components/mascot';
import { Paws, SubRatingsBars } from '@/components/paws';
import { Button, Card, Chip, ChipRow, Row, Screen, Section, T } from '@/components/ui';
import { get, mediaUri } from '@/lib/api';
import { cityName, priceBand } from '@/lib/format';
import { useRequireUser } from '@/lib/require-user';
import { radius, space, useColors } from '@/lib/theme';
import type { PlaceDetail, Review } from '@/lib/types';

export default function PlaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const c = useColors();
  const { width } = useWindowDimensions();
  const needUser = useRequireUser();
  const [sort, setSort] = useState<'recent' | 'helpful'>('recent');

  const place = useQuery({ queryKey: ['place', id], queryFn: () => get<PlaceDetail>(`/places/${id}`) });
  const reviews = useQuery({
    queryKey: ['place-reviews', id, sort],
    queryFn: () => get<{ reviews: Review[] }>(`/places/${id}/reviews`, { sort, limit: 30 }),
  });

  if (place.isLoading) return <Loading />;
  if (place.isError || !place.data) {
    return <EmptyState title={errorText(place.error)} action={<Button title={t('common.retry')} onPress={() => place.refetch()} />} />;
  }
  const p = place.data;
  const saved = p.savedInLists.length > 0;
  const mapsUrl =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?daddr=${p.lat},${p.lng}&q=${encodeURIComponent(p.name)}`
      : `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;

  return (
    <Screen scroll padded={false}>
      <Stack.Screen options={{ title: p.name }} />
      {p.photos.length ? (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
          {p.photos.map((ph) => (
            <Image key={ph.id} source={{ uri: mediaUri(ph.url) }} style={{ width: Math.min(width, 800), height: 240 }} contentFit="cover" transition={150} />
          ))}
        </ScrollView>
      ) : null}

      <View style={{ paddingHorizontal: space.l, gap: space.l }}>
        <View style={{ gap: space.s, marginTop: p.photos.length ? 0 : space.l }}>
          <T v="hero">{p.name}</T>
          <Row style={{ flexWrap: 'wrap' }}>
            <T v="dim">{categoryIcon(p.category)} {t(`categories.${p.category}`)}</T>
            {p.neighbourhood ? <T v="dim">· {p.neighbourhood}</T> : null}
            <T v="dim">· {cityName(p.city)}</T>
          </Row>
          <Row style={{ flexWrap: 'wrap' }} gap={space.m}>
            <Paws value={p.paws} size={18} />
            <T v="dim">{t('place.reviews', { count: p.reviewCount })}</T>
            {p.priceBracket ? <T v="dim">{priceBand(p.priceBracket)}</T> : null}
            <OpenBadge open={p.openNow} />
          </Row>
          {p.address ? <T v="small">📍 {p.address}</T> : null}
          {p.claimed ? <T v="dim">✅ {t('place.claimed')}</T> : null}
        </View>

        <Row style={{ flexWrap: 'wrap' }}>
          <Button
            testID="write-review"
            title={t('place.writeReview')}
            icon="✍️"
            onPress={() => needUser(() => router.push({ pathname: '/review/compose', params: { placeId: String(p.id), placeName: p.name } }))}
          />
          <Button
            testID="save-place"
            kind="secondary"
            title={saved ? t('place.saved') : t('place.save')}
            icon={saved ? '🔖' : '📑'}
            onPress={() => needUser(() => router.push({ pathname: '/save-to-list', params: { placeId: String(p.id) } }))}
          />
        </Row>
        <ChipRow>
          <Chip icon="🧭" label={t('place.directions')} onPress={() => Linking.openURL(mapsUrl)} />
          {p.phone ? <Chip icon="📞" label={t('place.call')} onPress={() => Linking.openURL(`tel:${p.phone.replace(/[^\d+]/g, '')}`)} /> : null}
          {p.zalo ? <Chip icon="💬" label={t('place.zalo')} onPress={() => Linking.openURL(`https://zalo.me/${p.zalo.replace(/[^\d]/g, '')}`)} /> : null}
          <Chip icon="↗️" label={t('common.share')} onPress={() => Share.share({ message: `${p.name} – ${mapsUrl}` })} />
        </ChipRow>

        {p.reviewCount ? (
          <Card>
            <SubRatingsBars ratings={p.ratings} />
          </Card>
        ) : null}

        {p.popularDishes.length ? (
          <Section title={t('place.popularDishes')}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.m }}>
              {p.popularDishes.map((d) => (
                <View key={d.name} style={{ width: 140, gap: 4 }}>
                  <View style={{ width: 140, height: 100, borderRadius: radius.m, backgroundColor: c.cardAlt, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                    {d.photoUrl ? (
                      <Image source={{ uri: mediaUri(d.photoUrl) }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                    ) : (
                      <T style={{ fontSize: 32 }}>🍜</T>
                    )}
                  </View>
                  <T v="bold" numberOfLines={2}>{d.name}</T>
                  <T v="dim">👍 {t('place.dishThumbs', { up: d.thumbsUp, total: d.mentions })}</T>
                </View>
              ))}
            </ScrollView>
          </Section>
        ) : null}

        {p.tagCounts.length ? (
          <Section title={t('place.tagsTitle')}>
            <ChipRow>
              {p.tagCounts.map((tc) => (
                <Chip key={tc.tag} label={`${t(`tags.${tc.tag}`)} · ${tc.count}`} />
              ))}
            </ChipRow>
          </Section>
        ) : null}

        <Section title={t('place.hours')}>
          <HoursTable hours={p.openingHours} />
        </Section>

        <Section
          title={t('place.whatPeopleSay')}
          right={
            <Row gap={space.xs}>
              <Chip label={t('place.sortRecent')} selected={sort === 'recent'} onPress={() => setSort('recent')} />
              <Chip label={t('place.sortHelpful')} selected={sort === 'helpful'} onPress={() => setSort('helpful')} />
            </Row>
          }>
          {reviews.isLoading ? (
            <Loading />
          ) : reviews.data?.reviews.length ? (
            reviews.data.reviews.map((r) => <ReviewCard key={r.id} review={r} showPlace={false} />)
          ) : (
            <EmptyState mood="happy" title={t('place.noReviewsTitle')} body={t('place.noReviewsBody')} />
          )}
        </Section>

        <Button
          kind="ghost"
          small
          title={`🚩 ${t('common.report')}`}
          onPress={() => needUser(() => router.push({ pathname: '/report', params: { type: 'place', id: String(p.id) } }))}
        />
      </View>
    </Screen>
  );
}
