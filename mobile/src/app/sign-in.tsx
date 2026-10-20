import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorText } from '@/components/errors';
import { Mascot } from '@/components/mascot';
import { Button, Field, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { space, useColors } from '@/lib/theme';

export default function SignIn() {
  const { t } = useTranslation();
  const c = useColors();
  const auth = useAuth();
  const [mode, setMode] = useState<'choose' | 'login' | 'register'>('choose');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll>
      <View style={{ alignItems: 'center', gap: space.m, marginTop: space.l }}>
        <Mascot mood="happy" size={110} />
        <T v="hero" style={{ textAlign: 'center' }}>{t('auth.welcomeTitle')}</T>
        <T v="dim" style={{ textAlign: 'center' }}>{t('auth.welcomeBody')}</T>
      </View>

      {mode === 'choose' ? (
        <View style={{ gap: space.m }}>
          {auth.appleAvailable ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={999}
              style={{ height: 48 }}
              onPress={() => run(auth.signInApple)}
            />
          ) : null}
          {auth.googleAvailable ? <Button kind="secondary" icon="🇬" title={t('auth.withGoogle')} loading={busy} onPress={() => run(auth.signInGoogle)} /> : null}
          <Button testID="with-email" title={t('auth.withEmail')} icon="✉️" onPress={() => setMode('register')} />
          <Button kind="ghost" title={t('auth.haveAccount')} onPress={() => setMode('login')} />
          <Button kind="ghost" title={t('auth.browseFirst')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        </View>
      ) : (
        <View style={{ gap: space.m }}>
          {mode === 'register' ? (
            <Field testID="name" label={t('auth.displayName')} value={name} onChangeText={setName} autoCapitalize="words" maxLength={50} />
          ) : null}
          <Field testID="email" label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          <Field
            testID="password"
            label={t('auth.password')}
            hint={mode === 'register' ? t('auth.passwordHint') : undefined}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          />
          {error ? <T v="error">{error}</T> : null}
          <Button
            testID="submit-auth"
            title={mode === 'register' ? t('auth.createAccount') : t('common.signIn')}
            loading={busy}
            disabled={!email || password.length < (mode === 'register' ? 8 : 1) || (mode === 'register' && !name.trim())}
            onPress={() => run(() => (mode === 'register' ? auth.register(email.trim(), password, name.trim()) : auth.signInEmail(email.trim(), password)))}
          />
          <Button kind="ghost" title={mode === 'register' ? t('auth.haveAccount') : t('auth.noAccount')} onPress={() => setMode(mode === 'register' ? 'login' : 'register')} />
          <Button kind="ghost" title={t('common.back')} onPress={() => setMode('choose')} />
        </View>
      )}

      <Pressable onPress={() => router.push('/legal/terms')}>
        <T v="dim" style={{ textAlign: 'center', color: c.textDim }}>{t('auth.agree')}</T>
      </Pressable>
    </Screen>
  );
}
