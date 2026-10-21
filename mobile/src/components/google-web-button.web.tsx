import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { loadScript } from '@/lib/load-script';
import { usePublicConfig } from '@/lib/public-config';

declare const google: any;

/**
 * Google's own "Sign in with Google" button (their rules say it must be theirs on the web).
 * Shows only when the server has GOOGLE_WEB_CLIENT_ID.
 */
export function GoogleWebButton({ onIdToken }: { onIdToken: (idToken: string) => void }) {
  const clientId = usePublicConfig().config?.googleWebClientId;
  const { i18n } = useTranslation();
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const latest = useRef(onIdToken);
  useEffect(() => {
    latest.current = onIdToken;
  });

  useEffect(() => {
    if (!clientId || !width) return;
    let live = true;
    loadScript('https://accounts.google.com/gsi/client')
      .then(() => {
        if (!live || !box.current) return;
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (r: { credential?: string }) => r.credential && latest.current(r.credential),
          ux_mode: 'popup',
        });
        google.accounts.id.renderButton(box.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          width: Math.min(400, Math.floor(width)),
          locale: i18n.language,
        });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [clientId, width, i18n.language]);

  if (!clientId) return null;
  return (
    <View testID="google-web" onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ alignItems: 'center', minHeight: 44 }}>
      <div ref={box} />
    </View>
  );
}
