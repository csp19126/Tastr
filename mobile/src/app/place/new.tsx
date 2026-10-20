import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CATEGORIES, CITIES, WEEKDAYS, type Category, type CityId, type OpeningHours, type Weekday } from '@shared';
import { categoryIcon } from '@/components/cards';
import { errorText } from '@/components/errors';
import { PinPicker } from '@/components/pin-picker';
import { Button, Chip, ChipRow, Field, Row, Screen, Section, T } from '@/components/ui';
import { ApiError, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cityName } from '@/lib/format';
import { cityCentre, currentPoint, useMyLocation, type Point } from '@/lib/location';
import { radius, space, useColors } from '@/lib/theme';
import type { PlaceDetail } from '@/lib/types';

const TIME = /^([01]?\d|2[0-3])[:.h]?([0-5]\d)$/;
/** "7", "7:30", "730", "19h30" → "07:30". */
function normaliseTime(s: string): string | null {
  const v = s.trim();
  if (/^\d{1,2}$/.test(v) && Number(v) < 24) return `${v.padStart(2, '0')}:00`;
  const m = TIME.exec(v);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
}

type DayHours = { open: string; close: string };

function HoursEditor({ value, onChange }: { value: Record<Weekday, DayHours>; onChange: (v: Record<Weekday, DayHours>) => void }) {
  const { t } = useTranslation();
  const c = useColors();
  const input = { borderWidth: 1, borderColor: c.line, borderRadius: radius.s, paddingHorizontal: space.s, paddingVertical: 6, width: 72, color: c.text, backgroundColor: c.card, textAlign: 'center' as const };
  return (
    <View style={{ gap: space.s }}>
      {WEEKDAYS.map((d) => (
        <Row key={d}>
          <T v="bold" style={{ width: 48 }}>{t(`weekdays.${d}`)}</T>
          <TextInput style={input} placeholder="07:00" placeholderTextColor={c.textDim} value={value[d].open} onChangeText={(s) => onChange({ ...value, [d]: { ...value[d], open: s } })} />
          <T>–</T>
          <TextInput style={input} placeholder="22:00" placeholderTextColor={c.textDim} value={value[d].close} onChangeText={(s) => onChange({ ...value, [d]: { ...value[d], close: s } })} />
        </Row>
      ))}
      <Button
        small
        kind="ghost"
        title={t('addPlace.copyMonday')}
        onPress={() => onChange(Object.fromEntries(WEEKDAYS.map((d) => [d, { ...value.mon }])) as Record<Weekday, DayHours>)}
      />
    </View>
  );
}

const emptyHours = () => Object.fromEntries(WEEKDAYS.map((d) => [d, { open: '', close: '' }])) as Record<Weekday, DayHours>;

/** Nothing typed = we don't know (null). Some days typed = the blank days are closed. */
function toOpeningHours(h: Record<Weekday, DayHours>): OpeningHours | null | 'invalid' {
  const out: OpeningHours = {};
  let any = false;
  for (const d of WEEKDAYS) {
    const { open, close } = h[d];
    if (!open.trim() && !close.trim()) continue;
    const o = normaliseTime(open);
    const cl = normaliseTime(close);
    if (!o || !cl || o === cl) return 'invalid';
    out[d] = [[o, cl]];
    any = true;
  }
  return any ? out : null;
}

export default function NewPlace() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ forReview?: string; name?: string }>();
  const loc = useMyLocation(user?.homeCity);
  const [name, setName] = useState(params.name ?? '');
  const [category, setCategory] = useState<Category>('street_food');
  const [pin, setPin] = useState<Point | null>(null);
  const [city, setCity] = useState<CityId>((user?.homeCity as CityId) ?? 'da_nang');
  const [address, setAddress] = useState('');
  const [neighbourhood, setNeighbourhood] = useState('');
  const [phone, setPhone] = useState('');
  const [zalo, setZalo] = useState('');
  const [hours, setHours] = useState(emptyHours);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const point = pin ?? loc.point;

  function done(place: { id: number; name: string }) {
    qc.invalidateQueries({ queryKey: ['places'] });
    if (params.forReview) router.replace({ pathname: '/review/compose', params: { placeId: String(place.id), placeName: place.name } });
    else router.replace(`/place/${place.id}`);
  }

  async function submit(allowDuplicate = false) {
    const openingHours = toOpeningHours(hours);
    if (openingHours === 'invalid') {
      setError(t('errors.invalid_input'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const place = await post<PlaceDetail>('/places', {
        name: name.trim(), category, lat: point.lat, lng: point.lng, city, address, neighbourhood, phone, zalo, openingHours, allowDuplicate,
      });
      done(place);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'place_exists') {
        const existing = e.body.place as { id: number; name: string };
        const msg = t('addPlace.duplicateBody', { name: existing.name });
        if (Platform.OS === 'web') {
          // Web has no multi-button alert; confirm() is the closest thing.
          if (globalThis.confirm?.(`${t('addPlace.duplicateTitle')}\n${msg}`)) done(existing);
          else submit(true);
        } else {
          Alert.alert(t('addPlace.duplicateTitle'), msg, [
            { text: t('addPlace.useExisting'), onPress: () => done(existing) },
            { text: t('addPlace.differentPlace'), onPress: () => submit(true) },
          ]);
        }
      } else setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll>
      <T v="dim">{t('addPlace.help')}</T>
      <Field testID="place-name" label={t('addPlace.name')} placeholder={t('addPlace.namePlaceholder')} value={name} onChangeText={setName} maxLength={120} />
      <Section title={t('addPlace.category')}>
        <ChipRow>
          {CATEGORIES.map((cat) => (
            <Chip key={cat} testID={`new-cat-${cat}`} icon={categoryIcon(cat)} label={t(`categories.${cat}`)} selected={category === cat} onPress={() => setCategory(cat)} />
          ))}
        </ChipRow>
      </Section>
      <Section title={t('addPlace.pin')}>
        <T v="dim">{t('addPlace.pinHelp')}</T>
        <PinPicker value={point} onChange={setPin} />
        <Button
          small
          kind="secondary"
          icon="📍"
          title={t('addPlace.useMyLocation')}
          onPress={async () => {
            const here = await currentPoint();
            if (here) setPin(here);
          }}
        />
      </Section>
      <Section title={t('addPlace.city')}>
        <ChipRow>
          {CITIES.map((ct) => (
            <Chip
              key={ct.id}
              label={cityName(ct.id)}
              selected={city === ct.id}
              onPress={() => {
                setCity(ct.id);
                if (!pin && !loc.isReal) setPin(cityCentre(ct.id));
              }}
            />
          ))}
        </ChipRow>
      </Section>
      <Field label={`${t('addPlace.address')} (${t('common.optional')})`} value={address} onChangeText={setAddress} maxLength={300} />
      <Field label={`${t('addPlace.neighbourhood')} (${t('common.optional')})`} value={neighbourhood} onChangeText={setNeighbourhood} maxLength={100} />
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Field label={t('addPlace.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={30} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label={t('addPlace.zalo')} value={zalo} onChangeText={setZalo} keyboardType="phone-pad" maxLength={60} />
        </View>
      </Row>
      <Section title={`${t('addPlace.hours')} (${t('common.optional')})`}>
        <T v="dim">{t('addPlace.hoursHelp')}</T>
        <HoursEditor value={hours} onChange={setHours} />
      </Section>
      {error ? <T v="error">{error}</T> : null}
      <Button testID="submit-place" title={t('addPlace.submit')} icon="📍" loading={busy} disabled={!name.trim()} onPress={() => submit(false)} />
    </Screen>
  );
}
