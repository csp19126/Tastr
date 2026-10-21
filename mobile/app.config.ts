import type { ConfigContext, ExpoConfig } from 'expo/config';

// The app's name lives in shared/constants.ts (APP_NAME) for everything on screen;
// this is the name under the icon and in the stores. Change both together.
const NAME = 'Tastr';
// Must be unique in the App Store / Play Store. Pick yours before the first store build.
const BUNDLE_ID = process.env.APP_BUNDLE_ID ?? 'app.tastr.mobile';

// Google sign-in needs its iOS URL scheme ("com.googleusercontent.apps.…") from Google Cloud.
// Until it's set, the Google button simply doesn't appear.
const googleIosUrlScheme = process.env.GOOGLE_IOS_URL_SCHEME;

// Facebook sign-in needs the App ID and Client Token from developers.facebook.com (Settings → Basic / Advanced).
// Until both are set, the Facebook button doesn't appear in the phone apps.
const facebookAppId = process.env.FACEBOOK_APP_ID;
const facebookClientToken = process.env.FACEBOOK_CLIENT_TOKEN;

// Google Maps keys from Google Cloud. Android always uses Google Maps (store builds need the key);
// iPhones use Apple Maps unless an iOS key is set.
const mapsAndroidKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
const mapsIosKey = process.env.GOOGLE_MAPS_IOS_API_KEY;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: NAME,
  slug: 'tastr',
  scheme: 'tastr',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: BUNDLE_ID,
    supportsTablet: false,
    usesAppleSignIn: true,
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: BUNDLE_ID,
    adaptiveIcon: {
      backgroundColor: '#FFF4E6',
      foregroundImage: './assets/images/android-icon-foreground.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: { output: 'single', favicon: './assets/images/favicon.png' },
  plugins: [
    'expo-router',
    ['expo-splash-screen', { backgroundColor: '#FFF4E6', image: './assets/images/splash-icon.png', imageWidth: 160 }],
    'expo-secure-store',
    ['expo-localization', { supportedLocales: ['en', 'vi'] }],
    'expo-apple-authentication',
    [
      'expo-image-picker',
      {
        photosPermission: 'Tastr needs your photos so you can show everyone what you ate.',
        cameraPermission: 'Tastr uses the camera so you can snap your food before you eat it.',
        microphonePermission: false,
      },
    ],
    [
      'expo-location',
      { locationWhenInUsePermission: 'Tastr uses your location to find good places near you.' },
    ],
    [
      'react-native-maps',
      {
        ...(mapsAndroidKey ? { androidGoogleMapsApiKey: mapsAndroidKey } : {}),
        ...(mapsIosKey ? { iosGoogleMapsApiKey: mapsIosKey } : {}),
      },
    ],
    ...(googleIosUrlScheme
      ? [['@react-native-google-signin/google-signin', { iosUrlScheme: googleIosUrlScheme }] as [string, object]]
      : []),
    ...(facebookAppId && facebookClientToken
      ? [
          [
            'react-native-fbsdk-next',
            {
              appID: facebookAppId,
              clientToken: facebookClientToken,
              displayName: NAME,
              scheme: `fb${facebookAppId}`,
              isAutoInitEnabled: true,
              // Sign-in only: no ad tracking, no automatic app events, no "allow tracking?" pop-up.
              autoLogAppEventsEnabled: false,
              advertiserIDCollectionEnabled: false,
              iosUserTrackingPermission: false,
            },
          ] as [string, object],
        ]
      : []),
  ],
  experiments: { typedRoutes: false, reactCompiler: true },
  extra: {
    // Optional; the app works these out in development. Set for store builds.
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
    facebookAppId: facebookAppId && facebookClientToken ? facebookAppId : undefined,
    iosGoogleMaps: !!mapsIosKey,
  },
});
