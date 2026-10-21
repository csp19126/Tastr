/** Web only (see google-maps.web.ts): the phone apps use react-native-maps. */
export function loadGoogleMaps(_key: string, _language: string): Promise<any> {
  return Promise.reject(new Error('web only'));
}
export function onAuthFailure(_f: () => void): () => void {
  return () => {};
}
export async function addMarker(_maps: any, _map: any, _opts: object): Promise<any> {
  return null;
}
export function removeMarker(_m: any) {}
