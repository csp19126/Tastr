import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { SUB_RATINGS, type SubRating } from '@shared';
import { space, useColors } from '@/lib/theme';
import { Row, T } from './ui';

const PAW = '🐾';

/** "4.5 🐾🐾🐾🐾🐾" with the unearned paws faded. */
export function Paws({ value, size = 14, showNumber = true, count }: { value: number | null | undefined; size?: number; showNumber?: boolean; count?: number }) {
  const { t } = useTranslation();
  const c = useColors();
  if (value == null) return <T v="dim">{t('paws.none')}</T>;
  const full = Math.round(value);
  return (
    <Row gap={6} >
      {showNumber ? <Text style={{ fontWeight: '800', color: c.text, fontSize: size + 1 }}>{Number.isInteger(value) ? value : value.toFixed(1)}</Text> : null}
      <View style={{ flexDirection: 'row' }} accessible accessibilityLabel={t('paws.outOf', { n: value })}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Text key={n} style={{ fontSize: size, opacity: n <= full ? 1 : 0.18 }}>{PAW}</Text>
        ))}
      </View>
      {count != null ? <T v="dim">({count})</T> : null}
    </Row>
  );
}

/** Big tappable paws for the overall rating, with the verdict underneath. */
export function PawsInput({ value, onChange }: { value: number | null; onChange: (n: number) => void }) {
  const { t } = useTranslation();
  const c = useColors();
  return (
    <View style={{ alignItems: 'center', gap: space.s }}>
      <View style={{ flexDirection: 'row', gap: space.s }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            testID={`paw-${n}`}
            accessibilityRole="button"
            accessibilityLabel={`${n} – ${t(`paws.${n}` as 'paws.1')}`}
            onPress={() => onChange(n)}
            hitSlop={6}
            style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.9 : value === n ? 1.15 : 1 }] })}>
            <Text style={{ fontSize: 40, opacity: value != null && n <= value ? 1 : 0.2 }}>{PAW}</Text>
          </Pressable>
        ))}
      </View>
      <T v="bold" style={{ color: value ? c.primary : c.textDim, minHeight: 22 }}>
        {value ? t(`paws.${value}` as 'paws.1') : ' '}
      </T>
    </View>
  );
}

function Dots({ value, onChange, label }: { value?: number; onChange: (n?: number) => void; label: string }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          accessibilityRole="button"
          accessibilityLabel={`${label} ${n}`}
          hitSlop={4}
          onPress={() => onChange(value === n ? undefined : n)}
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: value != null && n <= value ? c.paw : c.cardAlt,
          }}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: value != null && n <= value ? '#fff' : c.textDim }}>{n}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Taste, Value, Service, Vibe, Cleanliness, each with its friend-who-reviews-food question. */
export function SubRatingsInput({ value, onChange }: { value: Partial<Record<SubRating, number>>; onChange: (v: Partial<Record<SubRating, number>>) => void }) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: space.m }}>
      {SUB_RATINGS.map((k) => (
        <View key={k} style={{ gap: 6 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="bold">{t(`ratings.${k}`)}</T>
            <T v="dim" style={{ flexShrink: 1, textAlign: 'right' }}>{t(`ratings.prompt.${k}`)}</T>
          </Row>
          <Dots value={value[k]} label={t(`ratings.${k}`)} onChange={(n) => onChange({ ...value, [k]: n })} />
        </View>
      ))}
    </View>
  );
}

/** Read-only bars for a place's average sub-ratings. */
export function SubRatingsBars({ ratings }: { ratings: Partial<Record<SubRating, number | null>> }) {
  const { t } = useTranslation();
  const c = useColors();
  const shown = SUB_RATINGS.filter((k) => ratings[k] != null);
  if (shown.length === 0) return null;
  return (
    <View style={{ gap: space.s }}>
      {shown.map((k) => (
        <Row key={k}>
          <T v="small" style={{ width: 96 }}>{t(`ratings.${k}`)}</T>
          <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: c.cardAlt, overflow: 'hidden' }}>
            <View style={{ width: `${((ratings[k] ?? 0) / 5) * 100}%`, height: 8, backgroundColor: c.paw }} />
          </View>
          <T v="small" style={{ width: 28, textAlign: 'right', fontWeight: '700' }}>{(ratings[k] ?? 0).toFixed(1)}</T>
        </Row>
      ))}
    </View>
  );
}
