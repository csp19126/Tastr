import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { EmptyState, Loading } from '@/components/mascot';
import { ProfileHeader, UserReviews } from '@/components/profile';
import { Button, ListRow, Row, Screen } from '@/components/ui';
import { get } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { UserProfile } from '@/lib/types';

export default function MeTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const profile = useQuery({ queryKey: ['user', String(user?.id), user?.id ?? 0], queryFn: () => get<UserProfile>(`/users/${user!.id}`), enabled: !!user });

  if (!user) {
    return (
      <Screen scroll>
        <EmptyState mood="happy" title={t('auth.welcomeTitle')} body={t('auth.welcomeBody')} action={<Button testID="me-sign-in" title={t('common.signIn')} onPress={() => router.push('/sign-in')} />} />
        <ListRow title={`⚙️ ${t('settings.title')}`} onPress={() => router.push('/settings')} />
        <ListRow title={`🐶 ${t('settings.about')}`} onPress={() => router.push('/about')} />
      </Screen>
    );
  }
  if (profile.isLoading || !profile.data) return <Loading />;

  return (
    <Screen scroll>
      <ProfileHeader
        profile={profile.data}
        actions={
          <Row>
            <Button small kind="secondary" title={t('profile.editProfile')} onPress={() => router.push('/edit-profile')} />
            <Button testID="open-settings" small kind="secondary" title={`⚙️ ${t('profile.settings')}`} onPress={() => router.push('/settings')} />
          </Row>
        }
      />
      <UserReviews userId={user.id} />
    </Screen>
  );
}
