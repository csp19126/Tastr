import { createElement, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { loadGoogleMaps, onAuthFailure } from '@/lib/google-maps';
import type { Point } from '@/lib/location';
import { usePublicConfig } from '@/lib/public-config';
import { radius, space } from '@/lib/theme';
import { Field } from './ui';

function parse(s: string): Point | null {
  const [lat, lng] = s.split(',').map((x) => Number(x.trim()));
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}
const fmt = (p: Point) => `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`;

type Props = { value: Point; onChange: (p: Point) => void; height?: number };

/**
 * Web version: with Google Maps (GOOGLE_MAPS_WEB_KEY on the server) it's the same drag-the-map
 * picker as the phones; without it, type the coordinates and see them on OpenStreetMap.
 * The coordinates box is there either way.
 */
export function PinPicker(props: Props) {
  const { config, loading } = usePublicConfig();
  const [failed, setFailed] = useState(false);
  const google = !!config?.googleMapsKey && !failed;
  return (
    <CoordinatesPicker
      {...props}
      map={
        loading ? null : google ? (
          <GooglePin value={props.value} onChange={props.onChange} mapsKey={config!.googleMapsKey!} mapId={config!.googleMapsMapId} onFail={() => setFailed(true)} />
        ) : undefined
      }
    />
  );
}

function GooglePin({ value, onChange, mapsKey, mapId, onFail }: Props & { mapsKey: string; mapId: string | null; onFail: () => void }) {
  const { i18n } = useTranslation();
  const box = useRef<HTMLDivElement>(null);
  const st = useRef({ map: null as any, reported: value });
  const [ready, setReady] = useState(false);
  const latest = useRef({ onChange, onFail });
  useEffect(() => {
    latest.current = { onChange, onFail };
  });
  const start = useRef(value);

  useEffect(() => {
    let live = true;
    const off = onAuthFailure(() => live && latest.current.onFail());
    loadGoogleMaps(mapsKey, i18n.language)
      .then(async (maps) => {
        const { Map } = await maps.importLibrary('maps');
        if (!live || !box.current) return;
        st.current.map = new Map(box.current, {
          center: start.current,
          zoom: 18,
          ...(mapId ? { mapId } : {}),
          clickableIcons: false,
          gestureHandling: 'greedy',
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });
        // Drag the map, not the pin: wherever the middle settles is the place.
        st.current.map.addListener('idle', () => {
          const c = st.current.map.getCenter();
          const p = { lat: Number(c.lat().toFixed(6)), lng: Number(c.lng().toFixed(6)) };
          if (Math.abs(p.lat - st.current.reported.lat) > 1e-6 || Math.abs(p.lng - st.current.reported.lng) > 1e-6) {
            st.current.reported = p;
            latest.current.onChange(p);
          }
        });
        setReady(true);
      })
      .catch(() => live && latest.current.onFail());
    return () => {
      live = false;
      off();
    };
  }, [mapsKey, mapId, i18n.language]);

  // Moved from outside ("I'm here now", or typed coordinates): glide the map there.
  useEffect(() => {
    if (!ready) return;
    const r = st.current.reported;
    if (Math.abs(r.lat - value.lat) > 1e-6 || Math.abs(r.lng - value.lng) > 1e-6) {
      st.current.reported = value;
      st.current.map.panTo(value);
    }
  }, [ready, value]);

  return (
    <View testID="google-pin" style={{ flex: 1 }}>
      <div ref={box} style={{ width: '100%', height: '100%' }} />
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 40, marginBottom: 40 }}>📍</Text>
      </View>
    </View>
  );
}

/** `map`: a map to show instead of OpenStreetMap (null while deciding). */
function CoordinatesPicker({ value, onChange, height = 260, map }: Props & { map?: React.ReactNode }) {
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
        {map !== undefined
          ? map
          : createElement('iframe', {
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
