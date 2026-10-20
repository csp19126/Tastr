import { createElement, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Point } from '@/lib/location';
import { radius, space } from '@/lib/theme';
import { Field } from './ui';

function parse(s: string): Point | null {
  const [lat, lng] = s.split(',').map((x) => Number(x.trim()));
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}
const fmt = (p: Point) => `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`;

/** Web preview: type the coordinates and see them on OpenStreetMap. Phones get the drag-the-map picker. */
export function PinPicker({ value, onChange, height = 260 }: { value: Point; onChange: (p: Point) => void; height?: number }) {
  const { t } = useTranslation();
  const [text, setText] = useState(fmt(value));
  const [seen, setSeen] = useState(value);
  // The pin moved from outside ("I'm here now"): show the new coordinates,
  // unless the move came from what's being typed here.
  if (seen.lat !== value.lat || seen.lng !== value.lng) {
    setSeen(value);
    const typed = parse(text);
    if (!typed || typed.lat !== value.lat || typed.lng !== value.lng) setText(fmt(value));
  }
  const d = 0.004;
  const bbox = [value.lng - d, value.lat - d, value.lng + d, value.lat + d].join(',');
  return (
    <View style={{ gap: space.s }}>
      <View style={{ height, borderRadius: radius.l, overflow: 'hidden' }}>
        {createElement('iframe', {
          title: 'pin',
          src: `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${value.lat},${value.lng}`,
          style: { border: 0, width: '100%', height: '100%' },
        })}
      </View>
      <Field
        label={t('addPlace.latLng')}
        value={text}
        onChangeText={(s) => {
          setText(s);
          const p = parse(s);
          if (p) onChange(p);
        }}
      />
    </View>
  );
}
