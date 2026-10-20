import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { REPORT_REASONS, REPORT_TARGETS, type ReportReason, type ReportTarget } from '@shared';
import { errorText } from '@/components/errors';
import { EmptyState } from '@/components/mascot';
import { Button, Field, ListRow, Screen, Section, T } from '@/components/ui';
import { post } from '@/lib/api';

export default function Report() {
  const { type, id } = useLocalSearchParams<{ type: string; id: string }>();
  const { t } = useTranslation();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const targetType = (REPORT_TARGETS as readonly string[]).includes(type) ? (type as ReportTarget) : 'review';

  if (sent) {
    return (
      <Screen>
        <EmptyState mood="happy" title={t('report.thanks')} action={<Button title={t('common.close')} onPress={() => router.back()} />} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Section title={t('report.why')}>
        <View>
          {REPORT_REASONS.map((r) => (
            <ListRow key={r} testID={`reason-${r}`} title={t(`report.${r}`)} onPress={() => setReason(r)} right={<T style={{ fontSize: 20 }}>{reason === r ? '🔘' : '⚪'}</T>} />
          ))}
        </View>
      </Section>
      <Field label={t('report.details')} value={details} onChangeText={setDetails} multiline maxLength={1000} style={{ minHeight: 80 }} />
      {error ? <T v="error">{error}</T> : null}
      <Button
        testID="send-report"
        title={t('report.send')}
        disabled={!reason}
        loading={busy}
        onPress={async () => {
          setBusy(true);
          setError(null);
          try {
            await post('/reports', { targetType, targetId: Number(id), reason, details: details.trim() });
            setSent(true);
          } catch (e) {
            setError(errorText(e));
          } finally {
            setBusy(false);
          }
        }}
      />
    </Screen>
  );
}
