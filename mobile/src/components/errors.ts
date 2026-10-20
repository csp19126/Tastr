import i18n from '@/lib/i18n';
import { ApiError } from '@/lib/api';

/** Turns any failure into a friendly sentence in the user's language. */
export function errorText(e: unknown): string {
  const code = e instanceof ApiError ? e.code : 'generic';
  const key = `errors.${code}`;
  return i18n.exists(key) ? i18n.t(key) : i18n.t('errors.generic');
}
