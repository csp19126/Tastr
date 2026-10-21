import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';

import { IOS_GOOGLE_MAPS } from '@/lib/config';
import type { Point } from '@/lib/location';
import { radius } from '@/lib/theme';

/**
 * Drag the map, not the pin: the pin stays in the middle and wherever it sits is the place.
 * Much easier with a thumb than dragging a tiny marker.
 */
export function PinPicker({ value, onChange, height = 260 }: { value: Point; onChange: (p: Point) => void; height?: number }) {
  const map = useRef<MapView>(null);
  const reported = useRef<Point>(value);
  const [initial] = useState({ latitude: value.lat, longitude: value.lng, latitudeDelta: 0.004, longitudeDelta: 0.004 });

  // Moved from outside (e.g. "I'm here now"): glide the map there.
  useEffect(() => {
    const r = reported.current;
    if (Math.abs(r.lat - value.lat) > 1e-6 || Math.abs(r.lng - value.lng) > 1e-6) {
      reported.current = value;
      map.current?.animateToRegion({ latitude: value.lat, longitude: value.lng, latitudeDelta: 0.004, longitudeDelta: 0.004 }, 400);
    }
  }, [value]);

  return (
    <View style={{ height, borderRadius: radius.l, overflow: 'hidden' }}>
      <MapView
        ref={map}
        provider={IOS_GOOGLE_MAPS ? PROVIDER_GOOGLE : undefined}
        style={{ flex: 1 }}
        initialRegion={initial}
        showsUserLocation
        onRegionChangeComplete={(r) => {
          reported.current = { lat: r.latitude, lng: r.longitude };
          onChange(reported.current);
        }}
      />
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 40, marginBottom: 40 }}>📍</Text>
      </View>
    </View>
  );
}
