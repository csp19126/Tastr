import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { del, get, patch, post, setApiToken, setOnUnauthorized } from './api';
import { GOOGLE } from './config';
import i18n, { type Lang } from './i18n';
import { loadToken, saveToken } from './secure';
import type { Me } from './types';

const LANG_KEY = 'tastr.language';

type AuthState = {
  ready: boolean;
  user: Me | null;
  signInEmail(email: string, password: string): Promise<void>;
  register(email: string, password: string, displayName: string): Promise<void>;
  signInGoogle(): Promise<void>;
  signInApple(): Promise<void>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
  updateMe(changes: Partial<Omit<Me, 'notifications'>> & { notifications?: Partial<Me['notifications']> }): Promise<void>;
  setUser(u: Me): void;
  setLanguage(lang: Lang): Promise<void>;
  googleAvailable: boolean;
  appleAvailable: boolean;
};

const AuthContext = createContext<AuthState | null>(null);

/**
 * Google sign-in uses native code that isn't inside Expo Go, so it's loaded only if present.
 * In Expo Go (or before the Google client IDs are set) the button just doesn't show.
 */
function googleModule(): any | null {
  if (Platform.OS === 'web' || !GOOGLE.webClientId) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-google-signin/google-signin');
    mod.GoogleSignin.configure({ webClientId: GOOGLE.webClientId, iosClientId: GOOGLE.iosClientId || undefined });
    return mod;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUserState] = useState<Me | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [google] = useState(googleModule);

  const setUser = useCallback((u: Me | null) => {
    setUserState(u);
    if (u && i18n.language !== u.language) i18n.changeLanguage(u.language);
  }, []);

  const signOutLocal = useCallback(async () => {
    setApiToken(null);
    await saveToken(null);
    setUserState(null);
  }, []);

  useEffect(() => {
    setOnUnauthorized(() => {
      signOutLocal();
    });
    (async () => {
      const lang = (await AsyncStorage.getItem(LANG_KEY).catch(() => null)) as Lang | null;
      if (lang) await i18n.changeLanguage(lang);
      const token = await loadToken();
      if (token) {
        setApiToken(token);
        try {
          setUser(await get<Me>('/me'));
        } catch (e: any) {
          // Offline: keep the token and try again next launch. Rejected: forget it.
          if (e?.status === 401) await signOutLocal();
        }
      }
      if (Platform.OS === 'ios') setAppleAvailable(await AppleAuthentication.isAvailableAsync().catch(() => false));
      setReady(true);
    })();
  }, [setUser, signOutLocal]);

  const finish = useCallback(
    async (res: { token: string; user: Me }) => {
      setApiToken(res.token);
      await saveToken(res.token);
      setUser(res.user);
    },
    [setUser],
  );

  const value = useMemo<AuthState>(
    () => ({
      ready,
      user,
      googleAvailable: !!google,
      appleAvailable,
      setUser,
      async signInEmail(email, password) {
        await finish(await post('/auth/login', { email, password }));
      },
      async register(email, password, displayName) {
        await finish(await post('/auth/register', { email, password, displayName, language: i18n.language }));
      },
      async signInGoogle() {
        if (!google) return;
        await google.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        const res = await google.GoogleSignin.signIn();
        if (!google.isSuccessResponse(res) || !res.data.idToken) return; // cancelled
        await finish(await post('/auth/google', { idToken: res.data.idToken, language: i18n.language }));
      },
      async signInApple() {
        try {
          const cred = await AppleAuthentication.signInAsync({
            requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
          });
          if (!cred.identityToken) return;
          const fullName = [cred.fullName?.givenName, cred.fullName?.familyName].filter(Boolean).join(' ') || undefined;
          await finish(await post('/auth/apple', { identityToken: cred.identityToken, fullName, language: i18n.language }));
        } catch (e: any) {
          if (e?.code === 'ERR_REQUEST_CANCELED') return;
          throw e;
        }
      },
      async signOut() {
        await post('/auth/logout').catch(() => {});
        if (google) await google.GoogleSignin.signOut().catch(() => {});
        await signOutLocal();
      },
      async deleteAccount() {
        await del('/me');
        if (google) await google.GoogleSignin.signOut().catch(() => {});
        await signOutLocal();
      },
      async updateMe(changes) {
        setUser(await patch<Me>('/me', changes));
      },
      async setLanguage(lang) {
        await i18n.changeLanguage(lang);
        await AsyncStorage.setItem(LANG_KEY, lang).catch(() => {});
        if (user) setUser(await patch<Me>('/me', { language: lang }));
      },
    }),
    [ready, user, google, appleAvailable, setUser, finish, signOutLocal],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
