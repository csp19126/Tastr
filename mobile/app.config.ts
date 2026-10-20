import type { ConfigContext, ExpoConfig } from 'expo/config';

// The app's name lives in shared/constants.ts (APP_NAME) for everything on screen;
// this is the name under the icon and in the stores. Change both together.
const NAME = 'Tastr';
// Must be unique in the App Store / Play Store. Pick yours before the first store build.
const BUNDLE_ID = process.env.APP_BUNDLE_ID ?? 'app.tastr.mobile';

// Google sign-in needs its iOS URL scheme ("com.googleusercontent.apps.…") from Google Cloud.
// Until it's set, the Google button simply doesn't appear.
const googleIosUrlScheme = process.env.GOOGLE_IOS_URL_SCHEME;

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
      { locationWhenInUsePermission: 'Tastr uses your location to sniff out good places near you.' },
    ],
    // Android store builds need a Google Maps key (Expo Go doesn't). iPhones use Apple Maps, no key needed.
    ['react-native-maps', process.env.GOOGLE_MAPS_ANDROID_API_KEY ? { androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY } : {}],
    ...(googleIosUrlScheme
      ? [['@react-native-google-signin/google-signin', { iosUrlScheme: googleIosUrlScheme }] as [string, object]]
      : []),
  ],
  experiments: { typedRoutes: false, reactCompiler: true },
  extra: {
    // Optional; the app works these out in development. Set for store builds.
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
  },
});
