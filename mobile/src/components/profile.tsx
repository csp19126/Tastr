import { useInfiniteQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { get } from '@/lib/api';
import { cityName, formatDate } from '@/lib/format';
import { space } from '@/lib/theme';
import type { Review, UserProfile } from '@/lib/types';
import { ReviewCard } from './cards';
import { EmptyState, Loading } from './mascot';
import { Avatar, Button, Row, T } from './ui';

/** The top of a profile page, shared by "Me" and other people's pages. */
export function ProfileHeader({ profile, actions }: { profile: UserProfile; actions?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <View style={{ alignItems: 'center', gap: space.s }}>
      <Avatar url={profile.photoUrl} name={profile.displayName} size={88} />
      <T v="title">{profile.displayName}</T>
      {profile.homeCity ? <T v="dim">📍 {cityName(profile.homeCity)} · {t('profile.joined', { date: formatDate(profile.joinedAt) })}</T> : null}
      {profile.bio ? <T style={{ textAlign: 'center' }}>{profile.bio}</T> : null}
      <Row gap={space.l} style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
        <T v="small">{t('profile.reviews', { count: profile.reviewCount })}</T>
        <T v="small">{t('profile.followers', { count: profile.followerCount })}</T>
        <T v="small">{t('profile.following', { count: profile.followingCount })}</T>
        <T v="small">{t('profile.helpful', { count: profile.helpfulCount })}</T>
      </Row>
      {actions}
    </View>
  );
}

export function UserReviews({ userId }: { userId: number }) {
  const { t } = useTranslation();
  const q = useInfiniteQuery({
    queryKey: ['user-reviews', userId],
    initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam }) => get<{ reviews: Review[] }>(`/users/${userId}/reviews`, { before: pageParam, limit: 20 }),
    getNextPageParam: (last) => (last.reviews.length === 20 ? last.reviews[19].id : undefined),
  });
  if (q.isLoading) return <Loading />;
  const reviews = q.data?.pages.flatMap((p) => p.reviews) ?? [];
  if (reviews.length === 0) return <EmptyState mood="sleep" title={t('profile.noReviews')} />;
  return (
    <View style={{ gap: space.m }}>
      {reviews.map((r) => (
        <ReviewCard key={r.id} review={r} />
      ))}
      {q.hasNextPage ? <Button kind="ghost" title={t('common.seeAll')} loading={q.isFetchingNextPage} onPress={() => q.fetchNextPage()} /> : null}
    </View>
  );
}
