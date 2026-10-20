import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { errorText } from '@/components/errors';
import { EmptyState, Loading } from '@/components/mascot';
import { ProfileHeader, UserReviews } from '@/components/profile';
import { Button, Row, Screen } from '@/components/ui';
import { del, get, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useRequireUser } from '@/lib/require-user';
import type { UserProfile } from '@/lib/types';

export default function UserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const needUser = useRequireUser();
  const profile = useQuery({ queryKey: ['user', id, user?.id ?? 0], queryFn: () => get<UserProfile>(`/users/${id}`) });
  const follow = useMutation({
    mutationFn: (on: boolean) => (on ? post(`/users/${id}/follow`) : del(`/users/${id}/follow`)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user', id] });
      qc.invalidateQueries({ queryKey: ['feed', 'following'] });
    },
  });

  if (profile.isLoading) return <Loading />;
  if (!profile.data) return <EmptyState title={errorText(profile.error)} />;
  const p = profile.data;
  const me = user?.id === p.id;

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: p.displayName }} />
      <ProfileHeader
        profile={p}
        actions={
          me ? (
            <Button small kind="secondary" title={t('profile.editProfile')} onPress={() => router.push('/edit-profile')} />
          ) : (
            <Row>
              <Button
                testID="follow"
                small
                kind={p.isFollowing ? 'secondary' : 'primary'}
                title={p.isFollowing ? `✓ ${t('profile.unfollow')}` : t('profile.follow')}
                loading={follow.isPending}
                onPress={() => needUser(() => follow.mutate(!p.isFollowing))}
              />
              <Button small kind="ghost" title={`🚩 ${t('common.report')}`} onPress={() => needUser(() => router.push({ pathname: '/report', params: { type: 'user', id: String(p.id) } }))} />
            </Row>
          )
        }
      />
      <UserReviews userId={p.id} />
    </Screen>
  );
}
