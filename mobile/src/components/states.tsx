import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { space, useColors } from '@/lib/theme';
import { T } from './ui';

/** The app logo: a steaming bowl with chopsticks. */
export function Logo({ size = 96 }: { size?: number }) {
  return <Image source={require('@/assets/images/logo.png')} style={{ width: size, height: size }} contentFit="contain" accessibilityIgnoresInvertColors />;
}

export function Loading({ label }: { label?: string }) {
  const { t } = useTranslation();
  const c = useColors();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.m, padding: space.xl }} accessibilityLabel={label ?? t('common.loading')}>
      <ActivityIndicator size="large" color={c.primary} />
      <T v="dim">{label ?? t('common.loading')}</T>
    </View>
  );
}

/** A friendly "nothing here" with a big food emoji instead of a blank screen. */
export function EmptyState({ icon = '🍽️', title, body, action }: { icon?: string; title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', gap: space.m, padding: space.xl }}>
      <Text style={{ fontSize: 56 }}>{icon}</Text>
      <T v="title" style={{ textAlign: 'center' }}>{title}</T>
      {body ? <T v="dim" style={{ textAlign: 'center', maxWidth: 320 }}>{body}</T> : null}
      {action}
    </View>
  );
}
