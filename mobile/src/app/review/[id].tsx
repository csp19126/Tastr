import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ReviewCard } from '@/components/cards';
import { errorText } from '@/components/errors';
import { EmptyState, Loading, Mascot } from '@/components/mascot';
import { Avatar, Button, Card, Field, Row, Screen, Section, T } from '@/components/ui';
import { del, get, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { useRequireUser } from '@/lib/require-user';
import { space } from '@/lib/theme';
import type { Comment, Review } from '@/lib/types';

export default function ReviewScreen() {
  const { id, posted } = useLocalSearchParams<{ id: string; posted?: string }>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const needUser = useRequireUser();
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  const review = useQuery({ queryKey: ['review', id], queryFn: () => get<Review>(`/reviews/${id}`) });
  const comments = useQuery({ queryKey: ['comments', id], queryFn: () => get<{ comments: Comment[] }>(`/reviews/${id}/comments`) });

  const helpful = useMutation({
    mutationFn: (on: boolean) => (on ? post<Review>(`/reviews/${id}/helpful`) : del<Review>(`/reviews/${id}/helpful`)),
    onSuccess: (r) => qc.setQueryData(['review', id], r),
    onError: (e) => setError(errorText(e)),
  });
  const send = useMutation({
    mutationFn: () => post<Comment>(`/reviews/${id}/comments`, { body: comment.trim() }),
    onSuccess: () => {
      setComment('');
      qc.invalidateQueries({ queryKey: ['comments', id] });
      qc.invalidateQueries({ queryKey: ['review', id] });
    },
    onError: (e) => setError(errorText(e)),
  });

  if (review.isLoading) return <Loading />;
  if (!review.data) return <EmptyState title={errorText(review.error)} />;
  const r = review.data;
  const mine = user?.id === r.author.id;

  async function remove() {
    const go = async () => {
      await del(`/reviews/${r.id}`);
      qc.invalidateQueries({ queryKey: ['place', String(r.place.id)] });
      qc.invalidateQueries({ queryKey: ['place-reviews', String(r.place.id)] });
      qc.invalidateQueries({ queryKey: ['feed'] });
      router.back();
    };
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(t('common.delete'))) await go();
    } else {
      Alert.alert(t('common.delete'), '', [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: go },
      ]);
    }
  }

  return (
    <Screen scroll>
      {posted ? (
        <Row style={{ justifyContent: 'center' }}>
          <Mascot mood="happy" size={56} />
          <T v="title">{t('review.posted')}</T>
        </Row>
      ) : null}
      <ReviewCard review={r} full />
      <Row style={{ flexWrap: 'wrap' }}>
        {!mine ? (
          <Button
            testID="helpful"
            small
            kind={r.votedHelpful ? 'primary' : 'secondary'}
            icon="👍"
            title={`${t('reviewCard.helpful')} · ${r.helpfulCount}`}
            loading={helpful.isPending}
            onPress={() => needUser(() => helpful.mutate(!r.votedHelpful))}
          />
        ) : (
          <>
            <Button small kind="secondary" icon="✏️" title={t('common.edit')} onPress={() => router.push({ pathname: '/review/compose', params: { reviewId: String(r.id) } })} />
            <Button small kind="ghost" title={t('common.delete')} onPress={remove} />
          </>
        )}
        {!mine ? (
          <Button testID="report-review" small kind="ghost" title={`🚩 ${t('common.report')}`} onPress={() => needUser(() => router.push({ pathname: '/report', params: { type: 'review', id: String(r.id) } }))} />
        ) : null}
      </Row>
      {error ? <T v="error">{error}</T> : null}

      <Section title={t('comments.title')}>
        {(comments.data?.comments ?? []).length === 0 ? <T v="dim">{t('comments.empty')}</T> : null}
        {(comments.data?.comments ?? []).map((cm) => (
          <Card key={cm.id} style={{ padding: space.m }}>
            <Pressable onPress={() => router.push(`/user/${cm.author.id}`)}>
              <Row>
                <Avatar url={cm.author.photoUrl} name={cm.author.displayName} size={28} />
                <T v="bold">{cm.author.displayName}</T>
                <T v="dim">{formatDate(cm.createdAt)}</T>
              </Row>
            </Pressable>
            <T>{cm.body}</T>
            <Row>
              {user?.id === cm.author.id || user?.role === 'admin' ? (
                <Button small kind="ghost" title={t('common.delete')} onPress={async () => { await del(`/comments/${cm.id}`); qc.invalidateQueries({ queryKey: ['comments', id] }); }} />
              ) : (
                <Button small kind="ghost" title={`🚩 ${t('common.report')}`} onPress={() => needUser(() => router.push({ pathname: '/report', params: { type: 'comment', id: String(cm.id) } }))} />
              )}
            </Row>
          </Card>
        ))}
        <View style={{ gap: space.s }}>
          <Field testID="comment-input" placeholder={t('comments.placeholder')} value={comment} onChangeText={setComment} multiline maxLength={1000} style={{ minHeight: 70 }} />
          <Button testID="send-comment" small title={t('comments.send')} disabled={!comment.trim()} loading={send.isPending} onPress={() => needUser(() => send.mutate())} />
        </View>
      </Section>
    </Screen>
  );
}
