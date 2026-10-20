import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Where the Tastr server lives.
 * - Store builds: set EXPO_PUBLIC_API_URL (e.g. https://api.yourdomain.com).
 * - Development: works it out from the computer running `expo start`, port 4000.
 */
function apiUrl(): string {
  const set = process.env.EXPO_PUBLIC_API_URL || (Constants.expoConfig?.extra?.apiUrl as string | undefined);
  if (set) return set.replace(/\/$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) return `http://${host}:4000`;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // The web version is served by the Tastr server itself, so it talks to wherever it came from.
    // (A local preview on port 8081 talks to a local server on 4000.)
    const { protocol, hostname, port, origin } = window.location;
    return port === '8081' ? `${protocol}//${hostname}:4000` : origin;
  }
  return Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
}

export const API_URL = apiUrl();

export const GOOGLE = {
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
};

export const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';
