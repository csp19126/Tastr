import path from 'node:path';

const list = (v: string | undefined) =>
  (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  adminEmails: list(process.env.ADMIN_EMAILS).map((e) => e.toLowerCase()),
  uploadDir: path.resolve(process.env.UPLOAD_DIR ?? './uploads'),
  /** The built web version of the app, served at / when present (the Docker image builds it). */
  webDir: path.resolve(process.env.WEB_DIR ?? './web'),
  publicUrl: (process.env.PUBLIC_URL ?? '').replace(/\/$/, ''),
  /** Every Google OAuth client id whose sign-ins are accepted (web, iOS, Android). */
  googleClientIds: [...new Set([...list(process.env.GOOGLE_CLIENT_IDS), ...list(process.env.GOOGLE_WEB_CLIENT_ID)])],
  /** The "Web application" Google client id: the web version's Google button uses it. */
  googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID ?? '',
  facebookAppId: process.env.FACEBOOK_APP_ID ?? '',
  /** Checks Facebook sign-ins on Android and the web. A password: only ever set in Railway's Variables. */
  facebookAppSecret: process.env.FACEBOOK_APP_SECRET ?? '',
  /** Google Maps for the web version (a browser key, locked to this site's address in Google Cloud). */
  googleMapsWebKey: process.env.GOOGLE_MAPS_WEB_KEY ?? '',
  googleMapsMapId: process.env.GOOGLE_MAPS_MAP_ID ?? '',
  appleBundleIds: list(process.env.APPLE_BUNDLE_IDS),
  /** Sign-up / log-in attempts allowed per IP address per 15 minutes. */
  authAttemptsPer15Min: Number(process.env.AUTH_ATTEMPTS_PER_15_MIN ?? 30),
  /** Sending email (password reset codes) through Resend. Unset = reset is switched off in production. */
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  emailFrom: process.env.EMAIL_FROM ?? 'Tastr <onboarding@resend.dev>',
  isProduction: process.env.NODE_ENV === 'production',
  /** Where "share a list" links point. Defaults to this API's own small web page. */
  shareBaseUrl: (process.env.SHARE_BASE_URL ?? process.env.PUBLIC_URL ?? '').replace(/\/$/, ''),
};
