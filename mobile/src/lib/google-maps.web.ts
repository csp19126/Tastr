let loading: Promise<any> | null = null;
let authFailed = false;
const failListeners = new Set<() => void>();

/**
 * Loads Google Maps for the web version. Resolves with `google.maps`.
 * A wrong or locked-down key loads fine but then fails: onAuthFailure hears about that.
 */
export function loadGoogleMaps(key: string, language: string): Promise<any> {
  if (authFailed) return Promise.reject(new Error('google maps key refused'));
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const w = window as any;
      w.__tastrMapsReady = () => resolve(w.google.maps);
      w.gm_authFailure = () => {
        authFailed = true;
        failListeners.forEach((f) => f());
      };
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?${new URLSearchParams({
        key,
        v: 'weekly',
        loading: 'async',
        language,
        region: 'VN',
        callback: '__tastrMapsReady',
      })}`;
      s.async = true;
      s.onerror = () => {
        loading = null;
        s.remove();
        reject(new Error('could not load google maps'));
      };
      document.head.appendChild(s);
    });
  }
  return loading;
}

export function onAuthFailure(f: () => void): () => void {
  if (authFailed) f();
  failListeners.add(f);
  return () => failListeners.delete(f);
}

/** A pin on the map. Uses Google's newer markers when the server has a Map ID, the classic ones otherwise. */
export async function addMarker(maps: any, map: any, opts: { lat: number; lng: number; title: string; color: string; mapId: string | null }) {
  const position = { lat: opts.lat, lng: opts.lng };
  if (opts.mapId) {
    const { AdvancedMarkerElement, PinElement } = await maps.importLibrary('marker');
    const pin = new PinElement({ background: opts.color, borderColor: '#FFFFFF', glyphColor: '#FFFFFF' });
    return new AdvancedMarkerElement({ map, position, title: opts.title, content: pin.element, gmpClickable: true });
  }
  return new maps.Marker({ map, position, title: opts.title });
}

export function removeMarker(m: any) {
  if ('setMap' in m) m.setMap(null);
  else m.map = null;
}
