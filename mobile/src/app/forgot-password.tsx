import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorText } from '@/components/errors';
import { Button, Field, Screen, T } from '@/components/ui';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { space } from '@/lib/theme';

/** Two steps: email → code + new password. Ends signed in. */
export default function ForgotPassword() {
  const { t } = useTranslation();
  const { resetPassword } = useAuth();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const sendCode = () =>
    run(async () => {
      await post('/auth/forgot', { email: email.trim() });
      setStep('code');
    });

  return (
    <Screen scroll>
      {step === 'email' ? (
        <View style={{ gap: space.m }}>
          <T v="dim">{t('reset.intro')}</T>
          <Field testID="reset-email" label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          {error ? <T v="error">{error}</T> : null}
          <Button testID="send-code" title={t('reset.sendCode')} loading={busy} disabled={!email.includes('@')} onPress={sendCode} />
        </View>
      ) : (
        <View style={{ gap: space.m }}>
          <T v="dim">{t('reset.sentTo', { email: email.trim() })}</T>
          <Field
            testID="reset-code"
            label={t('reset.code')}
            value={code}
            onChangeText={(s) => setCode(s.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
          />
          <Field
            testID="reset-password"
            label={t('reset.newPassword')}
            hint={t('auth.passwordHint')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
          />
          {error ? <T v="error">{error}</T> : null}
          <Button
            testID="save-password"
            title={t('reset.save')}
            loading={busy}
            disabled={code.length !== 6 || password.length < 8}
            onPress={() =>
              run(async () => {
                await resetPassword(email.trim(), code, password);
                router.dismissAll();
                router.replace('/me');
              })
            }
          />
          <Button kind="ghost" title={t('reset.resend')} disabled={busy} onPress={sendCode} />
          <Button kind="ghost" title={t('reset.differentEmail')} onPress={() => { setStep('email'); setCode(''); setError(null); }} />
        </View>
      )}
    </Screen>
  );
}
