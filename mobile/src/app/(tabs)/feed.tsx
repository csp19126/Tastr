import { useInfiniteQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ReviewCard } from '@/components/cards';
import { errorText } from '@/components/errors';
import { EmptyState, Loading } from '@/components/mascot';
import { Button, Chip, Row } from '@/components/ui';
import { get } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { space, useColors } from '@/lib/theme';
import type { Review } from '@/lib/types';

export default function Feed() {
  const { t } = useTranslation();
  const c = useColors();
  const { user } = useAuth();
  const [scope, setScope] = useState<'city' | 'following'>('city');

  const feed = useInfiniteQuery({
    queryKey: ['feed', scope, user?.id ?? 0],
    enabled: scope === 'city' || !!user,
    initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam }) => get<{ reviews: Review[] }>('/feed', { scope, before: pageParam, limit: 15 }),
    getNextPageParam: (last) => (last.reviews.length === 15 ? last.reviews[last.reviews.length - 1].id : undefined),
  });
  const reviews = feed.data?.pages.flatMap((p) => p.reviews) ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Row style={{ paddingHorizontal: space.l, paddingTop: space.s }}>
        <Chip testID="feed-city" label={t('feed.city')} selected={scope === 'city'} onPress={() => setScope('city')} />
        <Chip testID="feed-following" label={t('feed.following')} selected={scope === 'following'} onPress={() => setScope('following')} />
      </Row>
      {scope === 'following' && !user ? (
        <EmptyState mood="happy" title={t('auth.needAccountTitle')} body={t('feed.emptyFollowingBody')} action={<Button title={t('common.signIn')} onPress={() => router.push('/sign-in')} />} />
      ) : feed.isLoading ? (
        <Loading />
      ) : feed.isError ? (
        <EmptyState title={errorText(feed.error)} action={<Button title={t('common.retry')} onPress={() => feed.refetch()} />} />
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(r) => String(r.id)}
          renderItem={({ item }) => <ReviewCard review={item} />}
          contentContainerStyle={{ padding: space.l, gap: space.m, paddingBottom: space.xxl * 2 }}
          refreshing={feed.isRefetching}
          onRefresh={() => feed.refetch()}
          onEndReached={() => feed.hasNextPage && !feed.isFetchingNextPage && feed.fetchNextPage()}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            scope === 'following' ? (
              <EmptyState mood="sniff" title={t('feed.emptyFollowingTitle')} body={t('feed.emptyFollowingBody')} />
            ) : (
              <EmptyState mood="sleep" title={t('feed.emptyCityTitle')} body={t('feed.emptyCityBody')} action={<Button icon="📸" title={t('review.start')} onPress={() => router.push('/review/compose')} />} />
            )
          }
        />
      )}
    </View>
  );
}
