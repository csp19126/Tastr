import { createElement } from 'react';
import { View } from 'react-native';

import type { Point } from '@/lib/location';
import type { PlaceCard } from '@/lib/types';

/** Web preview only: an OpenStreetMap view of the area. The phone apps use the native map. */
export function PlacesMap({ centre }: { places: PlaceCard[]; centre: Point; showsUser?: boolean }) {
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
