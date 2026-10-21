import { router } from 'expo-router';
import { createElement, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { addMarker, loadGoogleMaps, onAuthFailure, removeMarker } from '@/lib/google-maps';
import type { Point } from '@/lib/location';
import { usePublicConfig } from '@/lib/public-config';
import { useColors } from '@/lib/theme';
import type { PlaceCard } from '@/lib/types';
import { categoryIcon } from './cards';

type Props = { places: PlaceCard[]; centre: Point; showsUser?: boolean };

/**
 * The web version's map: Google Maps when the server has GOOGLE_MAPS_WEB_KEY,
 * otherwise (or if Google says no to the key) a plain OpenStreetMap view.
 */
export function PlacesMap(props: Props) {
  const { config, loading } = usePublicConfig();
  const [failed, setFailed] = useState(false);
  if (loading) return <View style={{ flex: 1 }} />;
  if (config?.googleMapsKey && !failed) {
    return <GooglePlacesMap {...props} mapsKey={config.googleMapsKey} mapId={config.googleMapsMapId} onFail={() => setFailed(true)} />;
  }
  return <OsmMap centre={props.centre} />;
}

function OsmMap({ centre }: { centre: Point }) {
  const d = 0.03;
  const bbox = [centre.lng - d, centre.lat - d, centre.lng + d, centre.lat + d].join(',');
  return (
    <View style={{ flex: 1 }}>
      {createElement('iframe', {
        title: 'map',
        src: `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${centre.lat},${centre.lng}`,
        style: { border: 0, width: '100%', height: '100%' },
      })}
    </View>
  );
}

/** A little card in the pin's bubble; tapping it opens the place. Built by hand because it lives inside Google's map. */
function bubble(p: PlaceCard, openLabel: string) {
  const el = document.createElement('button');
  el.type = 'button';
  el.style.cssText = 'all:unset;cursor:pointer;display:block;max-width:220px;font:14px system-ui,sans-serif;color:#2B1D14';
  const name = document.createElement('div');
  name.style.fontWeight = '700';
  name.textContent = `${categoryIcon(p.category)} ${p.name}`;
  const meta = document.createElement('div');
  meta.style.cssText = 'margin-top:2px;color:#7A6455';
  meta.textContent = `${p.rating != null ? `★ ${p.rating.toFixed(1)} · ` : ''}${openLabel} ›`;
  el.append(name, meta);
  el.onclick = () => router.push(`/place/${p.id}`);
  return el;
}

function GooglePlacesMap({ places, centre, mapsKey, mapId, onFail }: Props & { mapsKey: string; mapId: string | null; onFail: () => void }) {
  const c = useColors();
  const { t, i18n } = useTranslation();
  const box = useRef<HTMLDivElement>(null);
  const st = useRef({ maps: null as any, map: null as any, info: null as any });
  const [ready, setReady] = useState(false);
  const failRef = useRef(onFail);
  useEffect(() => {
    failRef.current = onFail;
  });
  const startCentre = useRef(centre);

  useEffect(() => {
    let live = true;
    const off = onAuthFailure(() => live && failRef.current());
    loadGoogleMaps(mapsKey, i18n.language)
      .then(async (maps) => {
        const { Map, InfoWindow } = await maps.importLibrary('maps');
        if (!live || !box.current) return;
        st.current.maps = maps;
        st.current.map = new Map(box.current, {
          center: startCentre.current,
          zoom: 14,
          ...(mapId ? { mapId } : {}),
          clickableIcons: false,
          gestureHandling: 'greedy',
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });
        st.current.info = new InfoWindow();
        setReady(true);
      })
      .catch(() => live && failRef.current());
    return () => {
      live = false;
      off();
    };
  }, [mapsKey, mapId, i18n.language]);

  // When the phone finds where we are (or the city changes), move there.
  useEffect(() => {
    if (ready) st.current.map.panTo({ lat: centre.lat, lng: centre.lng });
  }, [ready, centre.lat, centre.lng]);

  useEffect(() => {
    if (!ready) return;
    const g = st.current;
    const openLabel = t('common.view');
    let live = true;
    const shown: any[] = [];
    for (const p of places) {
      addMarker(g.maps, g.map, { lat: p.lat, lng: p.lng, title: p.name, color: c.primary, mapId }).then((m) => {
        if (!live) return removeMarker(m);
        shown.push(m);
        m.addListener('click', () => {
          g.info.setContent(bubble(p, openLabel));
          g.info.open({ map: g.map, anchor: m });
        });
      });
    }
    return () => {
      live = false;
      shown.forEach(removeMarker);
    };
  }, [ready, places, mapId, c.primary, t]);

  return (
    <View testID="google-map" style={{ flex: 1 }}>
      <div ref={box} style={{ width: '100%', height: '100%' }} />
    </View>
  );
}
