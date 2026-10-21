import { useEffect, useState } from 'react';

import { loadScript } from './load-script';
import { usePublicConfig } from './public-config';

declare const FB: any;

// Facebook supports each version for at least two years; move this on when they say so.
const SDK_VERSION = 'v23.0';

let initialised: string | null = null;

/** The web version's "Continue with Facebook", switched on from the server (FACEBOOK_APP_ID). */
export function useFacebook() {
  const appId = usePublicConfig().config?.facebookAppId ?? null;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!appId) return;
    let live = true;
    loadScript('https://connect.facebook.net/en_US/sdk.js')
      .then(() => {
        if (initialised !== appId) {
          FB.init({ appId, version: SDK_VERSION, cookie: false, xfbml: false });
          initialised = appId;
        }
        if (live) setReady(true);
      })
      .catch(() => {}); // blocked by the browser: the button just stays hidden
    return () => {
      live = false;
    };
  }, [appId]);
  return {
    available: ready,
    // Must be called straight from the tap, or the browser blocks Facebook's pop-up.
    credential(): Promise<Record<string, string> | null> {
      return new Promise((resolve) => {
        // Facebook refuses async callbacks, so this one is plain.
        FB.login(
          (res: any) => resolve(res?.authResponse?.accessToken ? { accessToken: res.authResponse.accessToken } : null),
          { scope: 'public_profile' },
        );
      });
    },
  };
}

export function facebookSignOut() {}
