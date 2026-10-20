import { Image } from 'expo-image';
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { space } from '@/lib/theme';
import { T } from './ui';

const ART = {
  happy: require('@/assets/mascot/happy.png'),
  sniff: require('@/assets/mascot/sniff.png'),
  sleep: require('@/assets/mascot/sleep.png'),
};

export type Mood = keyof typeof ART;

export function Mascot({ mood = 'happy', size = 120 }: { mood?: Mood; size?: number }) {
  return <Image source={ART[mood]} style={{ width: size, height: size }} contentFit="contain" accessibilityIgnoresInvertColors />;
}

/** The dog, nose down, sniffing about while something loads. */
export function Loading({ label }: { label?: string }) {
  const { t } = useTranslation();
  const [bob] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);
  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, 6] });
  const rotate = bob.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '4deg'] });
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.m, padding: space.xl }} accessibilityLabel={label ?? t('common.loading')}>
      <Animated.View style={{ transform: [{ translateY }, { rotate }] }}>
        <Mascot mood="sniff" size={96} />
      </Animated.View>
      <T v="dim">{label ?? t('common.loading')}</T>
    </View>
  );
}

export function EmptyState({ mood = 'sleep', title, body, action }: { mood?: Mood; title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', gap: space.m, padding: space.xl }}>
      <Mascot mood={mood} size={110} />
      <T v="title" style={{ textAlign: 'center' }}>{title}</T>
      {body ? <T v="dim" style={{ textAlign: 'center', maxWidth: 320 }}>{body}</T> : null}
      {action}
    </View>
  );
}
