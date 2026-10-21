import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import { FACEBOOK_APP_ID } from './config';

/** Facebook's native code isn't in Expo Go, so it's only loaded in builds that were given an App ID. */
function fbsdk(): any | null {
  if (!FACEBOOK_APP_ID) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-fbsdk-next');
  } catch {
    return null;
  }
}
const sdk = fbsdk();

export function useFacebook() {
  return {
    available: !!sdk,
    /** Opens Facebook; gives what the server needs to check, or null if the person backed out. */
    async credential(): Promise<Record<string, string> | null> {
      if (!sdk) return null;
      sdk.LoginManager.logOut(); // so a different Facebook account can be picked
      if (Platform.OS === 'ios') {
        // iPhones get "Limited Login": a signed token, no tracking.
        const nonce = Crypto.randomUUID();
        const res = await sdk.LoginManager.logInWithPermissions(['public_profile'], 'limited', nonce);
        if (res.isCancelled) return null;
        const t = await sdk.AuthenticationToken.getAuthenticationTokenIOS();
        return t?.authenticationToken ? { authenticationToken: t.authenticationToken, nonce } : null;
      }
      const res = await sdk.LoginManager.logInWithPermissions(['public_profile']);
      if (res.isCancelled) return null;
      const t = await sdk.AccessToken.getCurrentAccessToken();
      return t?.accessToken ? { accessToken: t.accessToken } : null;
    },
  };
}

export function facebookSignOut() {
  sdk?.LoginManager.logOut();
}
