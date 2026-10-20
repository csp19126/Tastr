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
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.protocol}//${window.location.hostname}:4000`;
  return Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
}

export const API_URL = apiUrl();

export const GOOGLE = {
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
};

export const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';
