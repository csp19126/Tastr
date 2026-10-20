import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { WEEKDAYS, type OpeningHours } from '@shared';
import { Row, T } from './ui';

export function HoursTable({ hours }: { hours: OpeningHours | null }) {
  const { t } = useTranslation();
  if (!hours || Object.keys(hours).length === 0) return <T v="dim">{t('place.hoursUnknown')}</T>;
  return (
    <View style={{ gap: 4 }}>
      {WEEKDAYS.map((d) => (
        <Row key={d} style={{ justifyContent: 'space-between' }}>
          <T v="small" style={{ width: 48, fontWeight: '700' }}>{t(`weekdays.${d}`)}</T>
          <T v="small">{hours[d]?.length ? hours[d]!.map(([a, b]) => `${a}–${b}`).join(', ') : t('place.closedToday')}</T>
        </Row>
      ))}
    </View>
  );
}
