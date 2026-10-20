import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { mediaUri } from '@/lib/api';
import { formatDate, formatDistance, formatPrice, priceSymbol } from '@/lib/format';
import { radius, space, useColors } from '@/lib/theme';
import type { ListPlace, PlaceCard as Place, Review } from '@/lib/types';
import { Stars } from './rating';
import { Avatar, Card, Row, T } from './ui';

const CATEGORY_ICON: Record<string, string> = {
  restaurant: '🍽️',
  street_food: '🥢',
  cafe: '☕',
  bar: '🍺',
  rooftop: '🌇',
  bakery: '🥐',
  dessert: '🍧',
};
export const categoryIcon = (c: string) => CATEGORY_ICON[c] ?? '🍴';

export function OpenBadge({ open }: { open: boolean | null }) {
  const { t } = useTranslation();
  const c = useColors();
  if (open == null) return null;
  return <T v="small" style={{ color: open ? c.green : c.textDim, fontWeight: '700' }}>{open ? t('place.open') : t('place.closed')}</T>;
}

export function PlaceCard({ place, compact }: { place: Place | ListPlace; compact?: boolean }) {
  const { t } = useTranslation();
  const c = useColors();
  const cover = mediaUri(place.coverUrl);
  const distance = 'distanceKm' in place ? place.distanceKm : null;
  return (
    <Card testID={`place-${place.id}`} onPress={() => router.push(`/place/${place.id}`)} style={{ flexDirection: 'row', padding: space.m, gap: space.m }}>
      <View style={{ width: compact ? 64 : 84, height: compact ? 64 : 84, borderRadius: radius.m, backgroundColor: c.cardAlt, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        {cover ? <Image source={{ uri: cover }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} /> : <Text style={{ fontSize: 30 }}>{categoryIcon(place.category)}</Text>}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <T v="bold" numberOfLines={1}>{place.name}</T>
        <Stars value={place.rating} count={place.reviewCount || undefined} />
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          <T v="dim">{t(`categories.${place.category}`)}</T>
          {place.priceBracket ? <T v="dim">· {priceSymbol(place.priceBracket)}</T> : null}
          {place.neighbourhood ? <T v="dim" numberOfLines={1}>· {place.neighbourhood}</T> : null}
          {distance != null ? <T v="dim">· {formatDistance(distance)}</T> : null}
        </Row>
        <OpenBadge open={place.openNow} />
      </View>
    </Card>
  );
}

function PhotoStrip({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.s }}>
      {urls.map((u) => (
        <Image key={u} source={{ uri: mediaUri(u) }} style={{ width: 132, height: 132, borderRadius: radius.m }} contentFit="cover" transition={150} />
      ))}
    </ScrollView>
  );
}

export function SponsoredLabel() {
  const { t } = useTranslation();
  const c = useColors();
  return (
    <View testID="sponsored-label" style={{ alignSelf: 'flex-start', backgroundColor: c.sponsored, borderRadius: radius.s, paddingHorizontal: space.s, paddingVertical: 3 }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>💸 {t('reviewCard.sponsored')}</Text>
    </View>
  );
}

export function ReviewCard({ review, showPlace = true, full = false }: { review: Review; showPlace?: boolean; full?: boolean }) {
  const { t } = useTranslation();
  const c = useColors();
  const [expanded, setExpanded] = useState(full);
  const long = review.body.length > 280;
  const photos = [...review.photos.map((p) => p.url), ...review.dishes.flatMap((d) => (d.photo ? [d.photo.url] : []))];
  return (
    <Card testID={`review-${review.id}`}>
      <Pressable onPress={() => router.push(`/user/${review.author.id}`)}>
        <Row>
          <Avatar url={review.author.photoUrl} name={review.author.displayName} size={36} />
          <View style={{ flex: 1 }}>
            <T v="bold">{review.author.displayName}</T>
            <T v="dim">{formatDate(review.createdAt)}{review.updatedAt !== review.createdAt ? ` · ${t('reviewCard.edited')}` : ''}</T>
          </View>
        </Row>
      </Pressable>
      {showPlace ? (
        <Pressable onPress={() => router.push(`/place/${review.place.id}`)}>
          <T v="link">{categoryIcon(review.place.category)} {review.place.name}</T>
        </Pressable>
      ) : null}
      {review.sponsored ? <SponsoredLabel /> : null}
      <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <Stars value={review.rating} size={16} showNumber={false} />
        <T v="bold" style={{ color: c.primary }}>{t(`rating.${review.rating}` as 'rating.1')}</T>
      </Row>
      <Pressable onPress={() => (full ? undefined : router.push(`/review/${review.id}`))}>
        <T numberOfLines={expanded ? undefined : 6}>{review.body}</T>
      </Pressable>
      {long && !expanded ? (
        <Pressable onPress={() => setExpanded(true)}>
          <T v="link">{t('reviewCard.readMore')}</T>
        </Pressable>
      ) : null}
      <PhotoStrip urls={photos} />
      {review.dishes.length ? (
        <View style={{ gap: 4 }}>
          {review.dishes.map((d) => (
            <T key={d.id} v="small">
              {d.thumbsUp ? '👍' : '👎'} <Text style={{ fontWeight: '700' }}>{d.name}</Text>
              {d.note ? ` – ${d.note}` : ''}
            </T>
          ))}
        </View>
      ) : null}
      <Row style={{ flexWrap: 'wrap' }} gap={space.s}>
        {review.pricePaid != null ? <T v="dim">{t('reviewCard.paid', { price: formatPrice(review.pricePaid, review.currency) })}</T> : null}
        {review.tags.map((tag) => (
          <T key={tag} v="dim">#{t(`tags.${tag}`)}</T>
        ))}
      </Row>
      {review.reply ? (
        <View style={{ backgroundColor: c.cardAlt, borderRadius: radius.m, padding: space.m, gap: 4 }}>
          <T v="label">{t('reviewCard.replyFrom', { name: review.reply.businessName })}</T>
          <T v="small">{review.reply.body}</T>
        </View>
      ) : null}
      {!full ? (
        <Pressable onPress={() => router.push(`/review/${review.id}`)}>
          <Row gap={space.l}>
            <T v="dim">👍 {t('reviewCard.helpfulCount', { count: review.helpfulCount })}</T>
            <T v="dim">💬 {t('reviewCard.comments', { count: review.commentCount })}</T>
          </Row>
        </Pressable>
      ) : null}
    </Card>
  );
}
