import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import MapView, { Callout, Marker } from 'react-native-maps';

import type { Point } from '@/lib/location';
import { useColors } from '@/lib/theme';
import type { PlaceCard } from '@/lib/types';
import { categoryIcon } from './cards';
import { Paws } from './paws';
import { T } from './ui';

/** Places on a real map. Tap a pin for the name, tap the bubble to open the place. */
export function PlacesMap({ places, centre, showsUser }: { places: PlaceCard[]; centre: Point; showsUser?: boolean }) {
  const c = useColors();
  const map = useRef<MapView>(null);
  const [initial] = useState({ latitude: centre.lat, longitude: centre.lng, latitudeDelta: 0.04, longitudeDelta: 0.04 });
  // When the phone finds where we are (or the city changes), move there.
  useEffect(() => {
    map.current?.animateToRegion({ latitude: centre.lat, longitude: centre.lng, latitudeDelta: 0.04, longitudeDelta: 0.04 }, 400);
  }, [centre.lat, centre.lng]);
  return (
    <MapView ref={map} style={{ flex: 1 }} initialRegion={initial} showsUserLocation={showsUser} showsMyLocationButton>
      {places.map((p) => (
        <Marker key={p.id} coordinate={{ latitude: p.lat, longitude: p.lng }} pinColor={c.primary} tracksViewChanges={false}>
          <Callout onPress={() => router.push(`/place/${p.id}`)}>
            <View style={{ maxWidth: 220, padding: 4, gap: 2 }}>
              <T v="bold" style={{ color: '#2B1D14' }}>{categoryIcon(p.category)} {p.name}</T>
              <Paws value={p.paws} size={12} />
            </View>
          </Callout>
        </Marker>
      ))}
    </MapView>
  );
}
