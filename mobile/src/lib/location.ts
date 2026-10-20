import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import { CITIES, type CityId } from '@shared';

export type Point = { lat: number; lng: number };

export function cityCentre(city: CityId | string | undefined): Point {
  const c = CITIES.find((x) => x.id === city) ?? CITIES[0];
  return { lat: c.lat, lng: c.lng };
}

/** Where am I? Falls back to the home city if location is off, so the app always shows something. */
export function useMyLocation(fallbackCity?: string) {
  const [point, setPoint] = useState<Point | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'denied'>('loading');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (!perm.granted) throw new Error('denied');
        const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 }).catch(() => null);
        if (last && alive) {
          setPoint({ lat: last.coords.latitude, lng: last.coords.longitude });
          setStatus('ok');
        }
        const now = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (alive) {
          setPoint({ lat: now.coords.latitude, lng: now.coords.longitude });
          setStatus('ok');
        }
      } catch {
        if (alive) setStatus((s) => (s === 'ok' ? s : 'denied'));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { point: point ?? cityCentre(fallbackCity), status, isReal: !!point };
}

export async function currentPoint(): Promise<Point | null> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return null;
    const now = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { lat: now.coords.latitude, lng: now.coords.longitude };
  } catch {
    return null;
  }
}
