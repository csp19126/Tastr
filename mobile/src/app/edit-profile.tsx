import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CITIES, LIMITS, type CityId } from '@shared';
import { errorText } from '@/components/errors';
import { Avatar, Button, Chip, ChipRow, Field, Screen, Section, T } from '@/components/ui';
import { uploadImage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cityName } from '@/lib/format';
import { pickPhotos } from '@/lib/photos';
import { space } from '@/lib/theme';
import type { Me } from '@/lib/types';

export default function EditProfile() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { user, updateMe, setUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [homeCity, setHomeCity] = useState<CityId>(user?.homeCity ?? 'da_nang');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!user) return null;

  async function changePhoto() {
    const res = await pickPhotos(1);
    if ('denied' in res) return Alert.alert('', t('photo.permissionPhotos'));
    if (!res.photos[0]) return;
    try {
      setUser((await uploadImage('/me/photo', res.photos[0].uri, 'PUT')) as Me);
      qc.invalidateQueries({ queryKey: ['user'] });
    } catch (e) {
      setError(errorText(e));
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await updateMe({ displayName: displayName.trim(), bio: bio.trim(), homeCity });
      qc.invalidateQueries({ queryKey: ['user'] });
      router.back();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll>
      <View style={{ alignItems: 'center', gap: space.s }}>
        <Avatar url={user.photoUrl} name={user.displayName} size={96} />
        <Button small kind="ghost" title={t('profile.changePhoto')} onPress={changePhoto} />
      </View>
      <Field label={t('auth.displayName')} value={displayName} onChangeText={setDisplayName} maxLength={50} />
      <Field label={t('profile.bio')} placeholder={t('profile.bioPlaceholder')} value={bio} onChangeText={setBio} multiline maxLength={LIMITS.bioMax} style={{ minHeight: 80 }} />
      <Section title={t('profile.homeCity')}>
        <ChipRow>
          {CITIES.map((c) => (
            <Chip key={c.id} label={cityName(c.id)} selected={homeCity === c.id} onPress={() => setHomeCity(c.id)} />
          ))}
        </ChipRow>
      </Section>
      {error ? <T v="error">{error}</T> : null}
      <Button title={t('common.save')} loading={busy} disabled={!displayName.trim()} onPress={save} />
    </Screen>
  );
}
