import path from 'node:path';

const list = (v: string | undefined) =>
  (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  adminEmails: list(process.env.ADMIN_EMAILS).map((e) => e.toLowerCase()),
  uploadDir: path.resolve(process.env.UPLOAD_DIR ?? './uploads'),
  publicUrl: (process.env.PUBLIC_URL ?? '').replace(/\/$/, ''),
  googleClientIds: list(process.env.GOOGLE_CLIENT_IDS),
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
